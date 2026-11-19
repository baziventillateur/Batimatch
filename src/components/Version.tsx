import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button, Dialog, Spinner } from './ui'

// Version de l'appli : numéro discret en bas de l'écran, détail et dernières nouveautés au toucher,
// et avis quand une nouvelle version a été publiée (un téléphone garde souvent la page ouverte des
// heures et ne verrait pas les nouveautés sans recharger).
declare const __VERSION__: { numero: string; date: string; historique: { numero: string; date: string; titre: string }[] }
const VERSION = __VERSION__

/** Script de l'appli chargé par cette page : il change de nom à chaque publication */
const current = [...document.querySelectorAll<HTMLScriptElement>('script[type=module][src]')].map((s) => s.getAttribute('src') ?? '').find((src) => /assets\/index-/.test(src))

function when(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')}`
}

/** Vrai si une version plus récente que celle affichée est en ligne */
async function newerOnline() {
  if (!current) return false
  const page = await fetch(`./?v=${Date.now()}`, { cache: 'no-store' }).then((r) => (r.ok ? r.text() : ''))
  const published = page.match(/assets\/index-[^"']+\.js/)?.[0]
  return !!published && !current.endsWith(published)
}

export function Version() {
  const [open, setOpen] = useState(false)
  const [stale, setStale] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [checking, setChecking] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const last = useRef(0)

  useEffect(() => {
    if (!current) return
    const check = async () => {
      if (document.hidden || Date.now() - last.current < 60_000) return
      last.current = Date.now()
      try {
        if (await newerOnline()) setStale(true)
      } catch {
        // Hors ligne : on réessaiera
      }
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    const every = window.setInterval(check, 5 * 60_000)
    // Au démarrage aussi : la page peut venir du cache du téléphone
    const first = window.setTimeout(check, 4000)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
      window.clearInterval(every)
      window.clearTimeout(first)
    }
  }, [])

  const verify = async () => {
    setChecking(true)
    setNote(null)
    try {
      if (await newerOnline()) return location.reload()
      setNote('Vous êtes à jour.')
    } catch {
      setNote('Vérification impossible : pas de connexion ?')
    }
    setChecking(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (setNote(null), setOpen(true))}
        className={`no-print fixed bottom-1 left-1.5 z-30 rounded px-1 py-0.5 text-[0.6875rem] leading-none tabular-nums transition-colors ${stale ? 'bg-warn-soft font-semibold text-warn' : 'text-ink-3/70 hover:text-ink-2'}`}
        aria-label={`Version ${VERSION.numero} de Batimatch`}
      >
        v{VERSION.numero}
        {stale && ' · mise à jour'}
      </button>

      {stale && !dismissed && !open && (
        <div role="status" className="anim-rise no-print fixed inset-x-3 bottom-6 z-40 mx-auto flex max-w-sm items-center gap-2 rounded-lg bg-night py-1.5 pr-1.5 pl-3.5 text-[0.875rem] text-white shadow-[var(--shadow-3)]">
          <span className="min-w-0 flex-1">Nouvelle version disponible</span>
          <button type="button" className="rounded px-2 py-1.5 text-[0.8125rem] text-white/70 hover:text-white" onClick={() => setDismissed(true)}>
            Plus tard
          </button>
          <Button size="sm" variant="primary" icon={<RefreshCw size={14} />} onClick={() => location.reload()}>
            Recharger
          </Button>
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Batimatch · versions">
        <p className="text-[0.9062rem]">
          <strong className="font-semibold">Version {VERSION.numero}</strong>
          <span className="text-ink-2"> du {when(VERSION.date)}</span>
          {stale && <span className="ml-1.5 rounded-[3px] bg-warn-soft px-1.5 py-px text-[0.75rem] font-semibold text-warn">Une version plus récente est en ligne</span>}
        </p>
        {VERSION.historique.length > 0 && (
          <>
            <h3 className="mt-4 mb-1 text-[0.8125rem] font-semibold text-ink-2">Dernières nouveautés</h3>
            <ul className="max-h-[46vh] divide-y divide-line overflow-y-auto rounded-md border border-line">
              {VERSION.historique.map((v) => (
                <li key={v.numero} className="grid grid-cols-[3.25rem_1fr] gap-x-2 px-2.5 py-1.5 text-[0.8438rem]">
                  <span className="font-semibold tabular-nums">{v.numero}</span>
                  <span className="min-w-0">
                    {v.titre.length > 110 ? `${v.titre.slice(0, 108)}…` : v.titre}
                    <span className="block text-[0.75rem] text-ink-3 tabular-nums">{when(v.date)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {note && (
            <span className="mr-auto text-[0.875rem] text-ink-2" role="status">
              {note}
            </span>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Fermer
          </Button>
          <Button variant="primary" disabled={checking} icon={checking ? <Spinner /> : <RefreshCw size={15} />} onClick={stale ? () => location.reload() : verify}>
            {stale ? 'Recharger' : 'Vérifier les mises à jour'}
          </Button>
        </div>
      </Dialog>
    </>
  )
}
