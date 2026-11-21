// Import d'un DPGF par IA (bêta) : l'acheteur dépose un PDF ou un Excel, la fonction le fait lire
// par Claude et renvoie les lignes (N°, désignation, unité, quantité) sous forme de tableau.
// Rien n'est écrit dans le lot : l'acheteur relit le résultat dans l'appli avant de l'importer.
// La clé Anthropic reste côté serveur (secret ANTHROPIC_API_KEY) ; 15 imports par compte et par 24 h.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as XLSX from 'npm:xlsx@0.18.5'

const MODEL = 'claude-sonnet-5-5'
const MAX_BYTES = 7 * 1024 * 1024
const MAX_TEXT = 150_000
const DAILY = 15

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const PROMPT = `Tu extrais un DPGF (décomposition du prix global et forfaitaire) de marché de travaux du bâtiment, en France.
Recopie toutes les lignes du document, dans l'ordre, sans en inventer ni en résumer.

Réponds uniquement par un tableau, une ligne par ligne du DPGF, colonnes séparées par une tabulation, sans en-tête, sans phrase avant ni après, sans mise en forme :
N°<TAB>Désignation<TAB>Unité<TAB>Quantité

Règles :
- Titre de chapitre ou de sous-chapitre : N° et désignation seulement, unité et quantité vides.
- Ligne d'ouvrage : unité telle qu'écrite (m2, m3, ml, u, ens, ft, kg…) et quantité en nombre avec une virgule décimale, sans séparateur de milliers. Si la quantité est absente, laisse-la vide.
- Garde la numérotation du document (1, 1.1, 2.3.4, PSE 1…). S'il n'y en a pas, laisse N° vide.
- Désignation sur une seule ligne, sans tabulation ; si elle court sur plusieurs lignes dans le document, réunis-les.
- Ignore les prix unitaires, les montants, les totaux, les sous-totaux, la TVA, les en-têtes et pieds de page, les cartouches et les signatures.
- Si le document contient plusieurs lots ou plusieurs feuilles, extrais-les tous à la suite, chaque lot commençant par une ligne de chapitre à son nom.
- Si le document n'est pas un DPGF ou un bordereau de prix (aucune liste d'ouvrages), réponds exactement : AUCUN_DPGF`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) return json({ error: 'ai_not_configured' }, 503)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await sb.auth.getUser(token)
  const user = auth?.user
  if (!user) return json({ error: 'ai_auth' }, 401)

  const body = await req.json().catch(() => null)
  const lotId = body?.lot_id
  const name = String(body?.name ?? 'document').slice(0, 200)
  const data = body?.data
  if (typeof lotId !== 'string' || !/^[0-9a-f-]{36}$/i.test(lotId) || typeof data !== 'string' || !data) return json({ error: 'ai_request' }, 400)

  // Réservé à l'acheteur du lot, sur un projet non verrouillé
  const { data: lot } = await sb.from('lots').select('id, project_id').eq('id', lotId).maybeSingle()
  const { data: project } = lot ? await sb.from('projects').select('owner_id, locked_at').eq('id', lot.project_id).maybeSingle() : { data: null }
  if (!project || project.owner_id !== user.id) return json({ error: 'ai_forbidden' }, 403)
  if (project.locked_at) return json({ error: 'project_locked' }, 409)

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count } = await sb.from('ai_imports').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since)
  if ((count ?? 0) >= DAILY) return json({ error: 'ai_quota' }, 429)

  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
  } catch {
    return json({ error: 'ai_request' }, 400)
  }
  if (bytes.length > MAX_BYTES) return json({ error: 'ai_too_big' }, 413)

  const ext = name.toLowerCase().split('.').pop() ?? ''
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
  let content: unknown[]
  if (isPdf) {
    content = [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }, { type: 'text', text: PROMPT }]
  } else if (['xlsx', 'xls', 'xlsm', 'csv', 'txt', 'tsv'].includes(ext)) {
    let text = ''
    try {
      if (['csv', 'txt', 'tsv'].includes(ext)) text = new TextDecoder().decode(bytes)
      else {
        const wb = XLSX.read(bytes, { type: 'array' })
        text = wb.SheetNames.map((s) => `### Feuille : ${s}\n${XLSX.utils.sheet_to_csv(wb.Sheets[s], { FS: '\t', blankrows: false })}`).join('\n\n')
      }
    } catch {
      return json({ error: 'ai_unreadable' }, 422)
    }
    if (!text.trim()) return json({ error: 'ai_unreadable' }, 422)
    if (text.length > MAX_TEXT) return json({ error: 'ai_too_big' }, 413)
    content = [{ type: 'text', text: `${PROMPT}\n\nContenu du fichier « ${name} » (colonnes séparées par des tabulations) :\n\n${text}` }]
  } else {
    return json({ error: 'ai_format' }, 415)
  }

  // Une ligne par tentative : c'est elle qui compte pour la limite quotidienne
  const { data: log } = await sb.from('ai_imports').insert({ user_id: user.id, lot_id: lotId, file_name: name, bytes: bytes.length }).select('id').single()

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 135_000)
  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 16000, messages: [{ role: 'user', content }] }),
    })
  } catch {
    return json({ error: 'ai_timeout' }, 504)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const detail = await res.text()
    console.error('anthropic', res.status, detail.slice(0, 500))
    return json({ error: res.status === 401 ? 'ai_not_configured' : res.status === 429 || res.status === 529 ? 'ai_busy' : res.status === 413 || /too long|too large|maximum/i.test(detail) ? 'ai_too_big' : 'ai_failed' }, 502)
  }
  const out = await res.json()
  const text: string = (out.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n').trim()
  if (log?.id) await sb.from('ai_imports').update({ input_tokens: out.usage?.input_tokens ?? null, output_tokens: out.usage?.output_tokens ?? null }).eq('id', log.id)
  if (!text || /^AUCUN_DPGF/.test(text)) return json({ error: 'ai_no_dpgf' }, 422)

  const rows = text
    .replace(/^```[a-z]*\n?|```$/g, '')
    .split('\n')
    .map((l) => l.replace(/\r/g, '').split('\t').map((c) => c.trim()))
    .filter((r) => r.length >= 2 && (r[0] || r[1]))
    .map((r) => [r[0] ?? '', r[1] ?? '', r[2] ?? '', r[3] ?? ''])
  if (!rows.length) return json({ error: 'ai_no_dpgf' }, 422)
  if (log?.id) await sb.from('ai_imports').update({ lines: rows.length }).eq('id', log.id)
  return json({ rows, truncated: out.stop_reason === 'max_tokens', left: Math.max(0, DAILY - (count ?? 0) - 1) })
})
