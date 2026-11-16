import { useCallback, useEffect, useState } from 'react'
import { Check, Clock, Mail, MessageSquareText, Phone, RefreshCw, Send, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { api, errorMessage } from '../data'
import { useAuth } from '../data/auth'
import type { SsoMessageRow, SsoRequestRow, SsoStatus } from '../data/rows'
import { Button, Dialog, EmptyState, ErrorBox, Field, IconButton, Loading, Segmented, Spinner, cx } from '../components/ui'

const STATUS: Record<SsoStatus, { label: string; tone: string }> = {
  new: { label: 'À traiter', tone: 'bg-warn-soft text-warn' },
  contacted: { label: 'Contactée', tone: 'bg-plan-soft text-plan' },
  in_progress: { label: 'Activation en cours', tone: 'bg-plan-soft text-plan' },
  activated: { label: 'Activée', tone: 'bg-good-soft text-good' },
  declined: { label: 'Sans suite', tone: 'bg-paper text-ink-2' },
}
const STATUS_ORDER: SsoStatus[] = ['new', 'contacted', 'in_progress', 'activated', 'declined']
const OPEN: SsoStatus[] = ['new', 'contacted', 'in_progress']
const isOpenSso = (r: SsoRequestRow) => OPEN.includes(r.status)

const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const providerLabel = (r: SsoRequestRow) => (r.provider === 'other' ? 'Autre annuaire' : 'Microsoft Entra ID')
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

interface Template {
  id: string
  label: string
  /** Statut donné à la demande une fois l'e-mail parti */
  status: SsoStatus
  subject: string
  body: (r: SsoRequestRow) => string
}

const TEMPLATES: Template[] = [
  {
    id: 'call',
    label: 'Proposer un appel',
    status: 'contacted',
    subject: 'Votre demande de connexion SSO Batimatch',
    body: (r) =>
      `Merci pour votre demande de connexion SSO pour ${r.company_name}.\n\nPour préparer l’activation, je vous propose un échange d’une quinzaine de minutes, idéalement avec un interlocuteur de votre service informatique. Quelles seraient vos disponibilités cette semaine ?`,
  },
  {
    id: 'tech',
    label: 'Demander les éléments techniques',
    status: 'in_progress',
    subject: 'Connexion SSO Batimatch : éléments à nous transmettre',
    body: (r) =>
      `Pour activer la connexion SSO Microsoft de ${r.company_name}, j’ai besoin des éléments suivants :\n\n1. l’identifiant de votre annuaire Microsoft Entra ID (Tenant ID) ;\n2. le ou les domaines e-mail concernés (par exemple @entreprise.fr) ;\n3. le contact de votre service informatique qui validera l’application Batimatch dans votre annuaire.\n\nDès réception, je vous confirme la date d’activation.`,
  },
  {
    id: 'done',
    label: 'Confirmer l’activation',
    status: 'activated',
    subject: 'La connexion SSO Batimatch est activée',
    body: (r) =>
      `La connexion SSO est activée pour ${r.company_name}. Vos collaborateurs peuvent se connecter à Batimatch avec leur compte professionnel Microsoft, depuis https://batimatch.paceapp.fr.\n\nJe reste à votre disposition pour accompagner les premières connexions.`,
  },
  {
    id: 'decline',
    label: 'Décliner poliment',
    status: 'declined',
    subject: 'Votre demande de connexion SSO Batimatch',
    body: (r) =>
      `Merci pour votre intérêt pour Batimatch. Nous ne sommes pas en mesure d’activer la connexion SSO pour ${r.company_name} pour le moment. Vos collaborateurs peuvent en attendant utiliser la connexion par e-mail et mot de passe.\n\nJe reviens vers vous dès que cela sera possible.`,
  },
]

function StatusChip({ status }: { status: SsoStatus }) {
  return <span className={cx('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.75rem] leading-tight font-semibold', STATUS[status].tone)}>{STATUS[status].label}</span>
}

/** Demandes de connexion SSO : liste, puis traitement complet dans une fenêtre (appel, réponse, statut, note) */
export default function AdminSso({ onCount }: { onCount?: (open: number) => void }) {
  const [rows, setRows] = useState<SsoRequestRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.listSsoRequests()
      setRows(list)
      setError(null)
      onCount?.(list.filter((r) => r.status === 'new').length)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [onCount])

  useEffect(() => {
    load()
  }, [load])

  if (error && !rows) return <ErrorBox message={error} onRetry={load} />
  if (!rows) return <Loading label="Demandes SSO" />

  const openCount = rows.filter(isOpenSso).length
  const shown = filter === 'open' ? rows.filter(isOpenSso) : rows
  const current = rows.find((r) => r.id === openId) ?? null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Filtrer les demandes"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: `En cours (${openCount})` },
            { value: 'all', label: `Toutes (${rows.length})` },
          ]}
        />
        <IconButton label="Actualiser" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={cx(loading && 'animate-spin')} />
        </IconButton>
      </div>
      {error && <ErrorBox message={error} onRetry={load} />}

      {shown.length === 0 ? (
        <EmptyState title={rows.length ? 'Aucune demande en cours' : 'Aucune demande SSO pour l’instant'}>
          Les entreprises déposent leur demande depuis le lien « Connexion entreprise par SSO » de la page de connexion. Vous êtes prévenu par e-mail et dans la cloche.
        </EmptyState>
      ) : (
        <ul className="overflow-hidden rounded-md border border-line bg-sheet">
          {shown.map((r, i) => {
            const replies = r.messages.filter((m) => m.kind === 'reply').length
            return (
              <li key={r.id} className={cx('flex items-stretch', i > 0 && 'border-t border-line')}>
                <button type="button" onClick={() => setOpenId(r.id)} className="min-w-0 flex-1 px-3.5 py-2.5 text-left hover:bg-paper/60 focus-visible:bg-paper/60">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-[0.9375rem] font-semibold">{r.company_name}</span>
                    <StatusChip status={r.status} />
                  </span>
                  <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-2">
                    {[r.contact_name, r.email].filter(Boolean).join(', ')}
                  </span>
                  <span className="mt-0.5 block text-[0.75rem] text-ink-3">
                    {[when(r.created_at), r.user_count && `${r.user_count} utilisateurs`, replies ? `${replies} réponse${replies > 1 ? 's' : ''} envoyée${replies > 1 ? 's' : ''}` : 'pas encore de réponse'].filter(Boolean).join(' · ')}
                  </span>
                </button>
                {r.phone && (
                  <a href={telHref(r.phone)} aria-label={`Appeler ${r.company_name}`} title={`Appeler le ${r.phone}`} className="grid w-12 shrink-0 place-items-center border-l border-line text-plan hover:bg-paper/60">
                    <Phone size={18} />
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {current && <RequestDialog key={current.id} r={current} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.75rem] text-ink-3">{label}</dt>
      <dd className="truncate text-[0.9062rem] font-medium">{children}</dd>
    </div>
  )
}

function MessageItem({ m }: { m: SsoMessageRow }) {
  const waiting = !m.emailed_at && Date.now() - new Date(m.created_at).getTime() < 2 * 60 * 1000
  const state = m.emailed_at
    ? { icon: <Check size={13} />, text: 'Envoyé', tone: 'text-good' }
    : waiting
      ? { icon: <Clock size={13} />, text: 'Envoi en cours', tone: 'text-ink-3' }
      : { icon: <TriangleAlert size={13} />, text: 'Non parti', tone: 'text-bad' }
  return (
    <li className="border-t border-line-2 py-2.5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-[0.875rem] font-semibold">{m.kind === 'ack' ? 'Accusé de réception automatique' : m.subject}</span>
        <span className={cx('inline-flex shrink-0 items-center gap-1 text-[0.75rem]', state.tone)}>
          {state.icon}
          {state.text} · {when(m.emailed_at ?? m.created_at)}
        </span>
      </div>
      {m.kind === 'reply' && <p className="mt-1 text-[0.8438rem] leading-snug whitespace-pre-wrap text-ink-2">{m.body}</p>}
    </li>
  )
}

function RequestDialog({ r, onClose, onChanged }: { r: SsoRequestRow; onClose: () => void; onChanged: () => Promise<void> }) {
  const { profile } = useAuth()
  const signature = `${[profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'L’équipe Batimatch'}\nBatimatch, by PaceApp`
  const fill = (t: Template) => `Bonjour ${r.contact_name || ''},`.replace(' ,', ',') + `\n\n${t.body(r)}\n\nBien cordialement,\n${signature}`

  const first = r.status === 'in_progress' ? TEMPLATES[2] : r.status === 'new' ? TEMPLATES[0] : TEMPLATES[1]
  const [tpl, setTpl] = useState(first.id)
  const [subject, setSubject] = useState(first.subject)
  const [body, setBody] = useState(() => fill(first))
  const [note, setNote] = useState(r.admin_note)
  const [noteSaved, setNoteSaved] = useState(false)
  const [busy, setBusy] = useState<'send' | 'status' | 'delete' | null>(null)
  const [sent, setSent] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const pick = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)
    setTpl(id)
    if (!t) return
    setSubject(t.subject)
    setBody(fill(t))
    setSent(false)
  }

  const send = () =>
    run('send', async () => {
      await api.sendSsoReply(r.id, subject, body)
      const next = TEMPLATES.find((t) => t.id === tpl)?.status
      if (next && next !== r.status) await api.updateSsoRequest(r.id, { status: next })
      setSent(true)
      await onChanged()
      // L'e-mail part en une ou deux secondes : on relit pour afficher « Envoyé »
      window.setTimeout(() => onChanged().catch(() => {}), 3000)
    })

  const setStatus = (status: SsoStatus) =>
    run('status', async () => {
      await api.updateSsoRequest(r.id, { status })
      await onChanged()
    })

  const saveNote = () => {
    if (note === r.admin_note) return
    run('status', async () => {
      await api.updateSsoRequest(r.id, { admin_note: note })
      setNoteSaved(true)
      await onChanged()
    })
  }

  const remove = () =>
    run('delete', async () => {
      await api.deleteSsoRequest(r.id)
      onClose()
      await onChanged()
    })

  return (
    <Dialog
      open
      onClose={onClose}
      title={r.company_name}
      wide
      footer={
        confirmDelete ? (
          <>
            <span className="mr-auto self-center text-[0.8438rem] text-ink-2">Supprimer la demande et son historique ?</span>
            <Button size="sm" onClick={() => setConfirmDelete(false)}>
              Annuler
            </Button>
            <Button size="sm" variant="danger" disabled={busy === 'delete'} onClick={remove}>
              Supprimer définitivement
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" className="mr-auto" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>
              Supprimer
            </Button>
            <Button size="sm" onClick={onClose}>
              Fermer
            </Button>
          </>
        )
      }
    >
      <div className="flex min-w-0 flex-col gap-5">
        {/* La demande */}
        <section className="flex min-w-0 flex-col gap-3">
          <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-4 gap-y-2.5 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
            <Fact label="Contact">{r.contact_name || '—'}</Fact>
            <Fact label="E-mail">
              <a href={`mailto:${r.email}`} className="text-plan underline-offset-2 hover:underline">
                {r.email}
              </a>
            </Fact>
            <Fact label="Téléphone">
              {r.phone ? (
                <a href={telHref(r.phone)} className="num text-plan underline-offset-2 hover:underline">
                  {r.phone}
                </a>
              ) : (
                '—'
              )}
            </Fact>
            <Fact label="Utilisateurs estimés">{r.user_count || '—'}</Fact>
            <Fact label="Annuaire">{providerLabel(r)}</Fact>
            <Fact label="Reçue le">{when(r.created_at)}</Fact>
          </dl>
          {r.message && <p className="rounded-md border border-line bg-paper/60 px-3 py-2 text-[0.875rem] leading-snug whitespace-pre-wrap text-ink-2">« {r.message} »</p>}
          <div className="flex flex-wrap gap-2">
            {r.phone && (
              <a href={telHref(r.phone)} className="inline-flex h-8 items-center gap-2 rounded-[5px] border border-plan-dark/40 bg-plan px-2.5 text-[0.8438rem] font-medium text-sheet hover:bg-plan-dark">
                <Phone size={14} /> Appeler
              </a>
            )}
            <a href={`mailto:${r.email}?subject=${encodeURIComponent(subject)}`} className="inline-flex h-8 items-center gap-2 rounded-[5px] border border-line bg-sheet px-2.5 text-[0.8438rem] font-medium hover:border-ink-3">
              <Mail size={14} /> Écrire depuis ma messagerie
            </a>
          </div>
        </section>

        {/* Suivi */}
        <section className="flex min-w-0 flex-col gap-3 border-t border-line-2 pt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3 className="text-[0.8438rem] font-medium text-ink-2">Statut</h3>
            <Segmented label="Statut de la demande" size="sm" value={r.status} onChange={setStatus} options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS[s].label }))} />
            {busy === 'status' && <Spinner />}
          </div>
          <Field label="Note interne (jamais envoyée)" htmlFor="sso-note" hint={noteSaved && note === r.admin_note ? 'Note enregistrée.' : undefined}>
            <textarea id="sso-note" rows={2} className="field resize-y" placeholder="Compte rendu d’appel, Tenant ID reçu, prochaine étape…" value={note} onChange={(e) => (setNote(e.target.value), setNoteSaved(false))} onBlur={saveNote} />
          </Field>
        </section>

        {/* Réponse par e-mail */}
        <section className="flex min-w-0 flex-col gap-3 border-t border-line-2 pt-4">
          <h3 className="flex items-center gap-2 font-title text-[1.1875rem] leading-none font-bold">
            <MessageSquareText size={17} className="text-plan" /> Répondre à l’entreprise
          </h3>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[17rem_minmax(0,1fr)]">
            <Field label="Modèle" htmlFor="sso-tpl">
              <select id="sso-tpl" className="field" value={tpl} onChange={(e) => pick(e.target.value)}>
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
                <option value="free">Message libre</option>
              </select>
            </Field>
            <Field label="Objet" htmlFor="sso-subject">
              <input id="sso-subject" className="field" maxLength={200} value={subject} onChange={(e) => (setSubject(e.target.value), setSent(false))} />
            </Field>
          </div>
          <Field
            label="Message"
            htmlFor="sso-body"
            hint={`Envoyé à ${r.email} avec la charte Batimatch. Sa réponse arrivera sur contact@paceapp.fr.${tpl !== 'free' ? ` Après l’envoi, la demande passe à « ${STATUS[TEMPLATES.find((t) => t.id === tpl)!.status].label} ».` : ''}`}
          >
            <textarea id="sso-body" rows={9} maxLength={5000} className="field resize-y text-[0.875rem] leading-snug" value={body} onChange={(e) => (setBody(e.target.value), setSent(false))} />
          </Field>
          {error && (
            <p className="rounded-md bg-bad-soft px-3 py-2 text-[0.875rem] text-bad" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" icon={busy === 'send' ? <Spinner /> : <Send size={15} />} disabled={busy === 'send' || !subject.trim() || !body.trim()} onClick={send}>
              Envoyer l’e-mail
            </Button>
            {sent && (
              <span className="anim-pop inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-good">
                <Check size={15} /> {api.kind === 'mock' ? 'Enregistré (démo : aucun e-mail ne part).' : 'E-mail en cours d’envoi.'}
              </span>
            )}
          </div>
        </section>

        {/* Historique */}
        <section className="flex min-w-0 flex-col gap-2.5 border-t border-line-2 pt-4">
          <h3 className="flex items-center gap-2 text-[0.8438rem] font-medium text-ink-2">
            <ShieldCheck size={15} /> E-mails envoyés à l’entreprise
          </h3>
          {r.messages.length === 0 ? <p className="text-[0.8438rem] text-ink-3">Aucun e-mail envoyé.</p> : <ul>{[...r.messages].reverse().map((m) => <MessageItem key={m.id} m={m} />)}</ul>}
        </section>
      </div>
    </Dialog>
  )
}
