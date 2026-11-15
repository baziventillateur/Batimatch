import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, Copy, Mail, MoreHorizontal, Pencil, Phone, Plus, Share2, Trash2, UserMinus } from 'lucide-react'
import { api, errorMessage } from '../data'
import { useAuth } from '../data/auth'
import type { ProjectBundle } from '../data/backend'
import { DEFAULT_SETTINGS, type Offer } from '../lib/types'
import { declaredBase, linesOf } from '../lib/calc'
import { daysUntil, fmtDate, fmtEur, fmtPctSigned, todayIso } from '../lib/format'
import { Button, CompanyLogo, Dialog, EmptyState, ErrorBox, Field, Loading, Menu, MenuItem, NumberInput, Spinner, cx, dueLabel } from '../components/ui'
import { ProjectForm } from './Home'

export default function ProjectPage() {
  const { pid = '' } = useParams()
  const { profile } = useAuth()
  const [b, setB] = useState<ProjectBundle | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setB(await api.getProject(pid))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [pid])
  useEffect(() => {
    load()
  }, [load])

  if (error) return <ErrorBox message={error} onRetry={load} />
  if (!b || !profile) return <Loading />
  return b.project.owner_id === profile.id ? <BuyerProject b={b} reload={load} /> : <CompanyProject b={b} />
}

// ————————————————————————— Acheteur —————————————————————————

const lineItemsCount = (items: ProjectBundle['lots'][number]['items']) => linesOf(items ?? []).length

function BuyerProject({ b, reload }: { b: ProjectBundle; reload: () => void }) {
  const nav = useNavigate()
  const [editing, setEditing] = useState(false)
  const [addingLot, setAddingLot] = useState(false)
  const submitted = b.offers.filter((o) => o.status === 'submitted' || o.source === 'manual')

  return (
    <div className="flex flex-col gap-5">
      <Link to="/" className="no-print inline-flex items-center gap-1 text-[14px] text-ink-2 hover:text-ink">
        <ChevronLeft size={16} /> Mes projets
      </Link>

      <section className="cartouche" aria-label="Projet">
        <div className="flex items-start justify-between gap-3 border-b border-ink/25 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h1 className="font-title text-[30px] leading-[1.05] font-bold sm:text-[36px]">{b.project.name}</h1>
            <p className="mt-1 text-[14.5px] text-ink-2">{b.project.reference || 'Sans référence'}</p>
          </div>
          <Menu label="Actions sur le projet" icon={<MoreHorizontal size={18} />}>
            {(close) => (
              <>
                <MenuItem icon={<Pencil />} onClick={() => (close(), setEditing(true))}>
                  Modifier le projet
                </MenuItem>
                <MenuItem
                  icon={<Trash2 />}
                  danger
                  onClick={async () => {
                    close()
                    if (!confirm(`Supprimer « ${b.project.name} », ses lots et toutes les offres reçues ? Cette action est définitive.`)) return
                    try {
                      await api.deleteProject(b.project.id)
                      nav('/')
                    } catch (e) {
                      alert(errorMessage(e))
                    }
                  }}
                >
                  Supprimer le projet
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
        <dl className="grid grid-cols-3">
          <div className="cartouche-cell border-r">
            <dt className="cartouche-label">Lots</dt>
            <dd className="num text-[20px] font-semibold">{b.lots.length}</dd>
          </div>
          <div className="cartouche-cell border-r">
            <dt className="cartouche-label">Entreprises inscrites</dt>
            <dd className="num text-[20px] font-semibold">{b.members.length}</dd>
          </div>
          <div className="cartouche-cell">
            <dt className="cartouche-label">Offres reçues</dt>
            <dd className="num text-[20px] font-semibold">{submitted.length}</dd>
          </div>
        </dl>
      </section>

      <InvitePanel code={b.project.access_code} projectName={b.project.name} />

      <section className="flex flex-col gap-3" aria-labelledby="lots-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="lots-title" className="font-title text-[26px] font-semibold">
            Lots et demandes d’offre
          </h2>
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAddingLot(true)}>
            Nouveau lot
          </Button>
        </div>
        {b.lots.length === 0 ? (
          <EmptyState title="Aucun lot" action={<Button variant="primary" onClick={() => setAddingLot(true)}>Créer le premier lot</Button>}>
            Créez un lot par corps d’état : sa DPGF, sa date de rendu et son budget objectif (que les entreprises ne voient pas).
          </EmptyState>
        ) : (
          <ul className="panel overflow-hidden">
            {b.lots.map((lot) => (
              <LotRow key={lot.id} b={b} lotId={lot.id} />
            ))}
          </ul>
        )}
      </section>

      <Members b={b} reload={reload} />

      <ProjectForm
        open={editing}
        onClose={() => setEditing(false)}
        initial={{ id: b.project.id, name: b.project.name, reference: b.project.reference, description: b.project.description }}
        onSaved={() => {
          setEditing(false)
          reload()
        }}
      />
      <LotForm
        open={addingLot}
        onClose={() => setAddingLot(false)}
        projectId={b.project.id}
        position={b.lots.length}
        onCreated={(id) => nav(`/p/${b.project.id}/l/${id}/dpgf`)}
      />
    </div>
  )
}

function LotRow({ b, lotId }: { b: ProjectBundle; lotId: string }) {
  const lot = b.lots.find((l) => l.id === lotId)!
  const priv = b.privates.find((p) => p.lot_id === lotId)
  const offers = b.offers.filter((o) => o.lot_id === lotId && (o.status === 'submitted' || o.source === 'manual'))
  const days = daysUntil(lot.due_date)
  const due = dueLabel(days)
  const best = useMemo(() => {
    const totals = offers
      .map((o) => declaredBase({ prices: o.prices } as Offer, lot.items ?? []) * (1 - (Number(o.discount_pct) || 0) / 100))
      .filter((v) => v > 0)
    return totals.length ? Math.min(...totals) : null
  }, [offers, lot.items])
  const budget = priv?.budget != null ? Number(priv.budget) : null
  const companies = [...new Map(offers.map((o) => [o.company_name.toLowerCase(), o])).values()]

  return (
    <li className="border-b border-line-2 last:border-0">
      <Link
        to={`/p/${b.project.id}/l/${lot.id}/${offers.length >= 2 ? 'decision' : lineItemsCount(lot.items) ? 'offres' : 'dpgf'}`}
        className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-paper/60 sm:px-5 md:grid-cols-[minmax(0,1.6fr)_1fr_1.2fr_1.1fr]"
      >
        <span className="min-w-0">
          <span className="block truncate text-[17px] font-semibold">{lot.name || 'Lot sans nom'}</span>
          <span className="block truncate text-[13.5px] text-ink-3">
            {[lot.code, `${lineItemsCount(lot.items)} lignes`].filter(Boolean).join(', ')}
          </span>
        </span>
        <span className="text-right text-[14px] md:text-left">
          <span className="num block">{fmtDate(lot.due_date)}</span>
          <span className={cx('block text-[12.5px]', due.tone === 'warn' ? 'font-medium text-warn' : 'text-ink-3')}>{due.text}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="flex -space-x-2">
            {companies.slice(0, 4).map((o) => (
              <CompanyLogo key={o.id} name={o.company_name || '?'} url={o.logo_url} size={28} className="ring-2 ring-sheet" />
            ))}
          </span>
          <span className="text-[14px] text-ink-2">
            <span className="num font-semibold text-ink">{offers.length}</span> offre{offers.length > 1 ? 's' : ''}
          </span>
        </span>
        <span className="col-span-2 text-[14px] md:col-span-1 md:text-right">
          {best != null ? (
            <>
              <span className="num font-semibold">{fmtEur(best)}</span>
              {budget ? <span className={cx('ml-2 text-[12.5px]', best > budget ? 'text-bad' : 'text-good')}>{fmtPctSigned(best / budget - 1)} budget</span> : null}
            </>
          ) : (
            <span className="text-ink-3">Aucun prix reçu</span>
          )}
        </span>
      </Link>
    </li>
  )
}

function InvitePanel({ code, projectName }: { code: string; projectName: string }) {
  const [copied, setCopied] = useState<string | null>(null)
  const link = `${window.location.origin}${window.location.pathname}#/rejoindre/${code}`
  const message = `Bonjour,\n\nNous vous invitons à remettre une offre pour le projet « ${projectName} » sur Batimatch.\n\n1. Créez votre compte entreprise : ${link}\n2. Le projet s’ouvre automatiquement (code d’accès : ${code}).\n\nVous pourrez y consulter les DPGF, saisir vos prix et modifier votre offre jusqu’à la date de rendu.\n\nCordialement,`
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      prompt('Copiez ce texte :', text)
    }
  }
  return (
    <section className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" aria-label="Inviter les entreprises">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">Inviter les entreprises</h2>
        <p className="max-w-[52ch] text-[14px] text-ink-2">
          Transmettez ce code ou le lien d’invitation : l’entreprise crée son compte et accède aux lots de ce projet. Elle ne verra ni votre budget ni les autres offres.
        </p>
      </div>
      <div className="flex flex-col items-start gap-2.5 sm:items-end">
        <button
          type="button"
          onClick={() => copy(code, 'code')}
          className="num rounded-md border-2 border-ink bg-sheet px-4 py-1.5 text-[30px] leading-tight font-semibold tracking-[0.3em] transition-transform active:scale-95"
          title="Copier le code"
        >
          {code}
        </button>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={copied === 'link' ? <Check size={15} /> : <Copy size={15} />} onClick={() => copy(link, 'link')}>
            {copied === 'link' ? 'Lien copié' : 'Copier le lien'}
          </Button>
          <Button size="sm" icon={copied === 'msg' ? <Check size={15} /> : <Mail size={15} />} onClick={() => copy(message, 'msg')}>
            {copied === 'msg' ? 'Message copié' : 'Copier le message'}
          </Button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button size="sm" icon={<Share2 size={15} />} onClick={() => navigator.share({ title: projectName, text: message }).catch(() => {})}>
              Partager
            </Button>
          )}
        </div>
        {copied === 'code' && <span className="anim-pop text-[13px] font-medium text-good">Code copié</span>}
      </div>
    </section>
  )
}

function Members({ b, reload }: { b: ProjectBundle; reload: () => void }) {
  if (!b.members.length) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="font-title text-[26px] font-semibold">Entreprises inscrites</h2>
        <p className="panel px-5 py-4 text-ink-2">Aucune entreprise n’a encore rejoint le projet. Partagez le code ci-dessus.</p>
      </section>
    )
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-title text-[26px] font-semibold">Entreprises inscrites</h2>
      <ul className="panel overflow-hidden">
        {b.members.map((m) => {
          const p = m.profile
          const sent = b.offers.filter((o) => o.company_id === m.user_id && o.status === 'submitted').length
          const name = p?.company_name || 'Entreprise'
          return (
            <li key={m.user_id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line-2 px-4 py-3 last:border-0 sm:px-5">
              <CompanyLogo name={name} url={p?.logo_url} size={40} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{name}</p>
                <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-[13.5px] text-ink-2">
                  <span>{[p?.first_name, p?.last_name].filter(Boolean).join(' ')}</span>
                  {p?.email && (
                    <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1 text-plan hover:underline">
                      <Mail size={13} /> {p.email}
                    </a>
                  )}
                  {p?.phone && (
                    <a href={`tel:${p.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 text-plan hover:underline">
                      <Phone size={13} /> {p.phone}
                    </a>
                  )}
                </p>
                <p className="text-[12.5px] text-ink-3">
                  Inscrite le {fmtDate(m.joined_at.slice(0, 10))}, {sent} offre{sent > 1 ? 's' : ''} envoyée{sent > 1 ? 's' : ''}
                </p>
              </div>
              <Menu label={`Actions pour ${name}`} icon={<MoreHorizontal size={17} />}>
                {(close) => (
                  <MenuItem
                    icon={<UserMinus />}
                    danger
                    onClick={async () => {
                      close()
                      if (!confirm(`Retirer ${name} du projet ? Elle n’aura plus accès aux lots.`)) return
                      try {
                        await api.removeMember(b.project.id, m.user_id)
                        reload()
                      } catch (e) {
                        alert(errorMessage(e))
                      }
                    }}
                  >
                    Retirer du projet
                  </MenuItem>
                )}
              </Menu>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function LotForm({
  open,
  onClose,
  projectId,
  position,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  position: number
  onCreated: (id: string) => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Nouveau lot">
      {open && <LotFormBody onClose={onClose} projectId={projectId} position={position} onCreated={onCreated} />}
    </Dialog>
  )
}

function LotFormBody({ onClose, projectId, position, onCreated }: { onClose: () => void; projectId: string; position: number; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ name: '', code: '', due: '', budget: null as number | null })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          const lot = await api.createLot({ project_id: projectId, name: f.name.trim(), code: f.code.trim(), due_date: f.due || null, description: '', items: [], position })
          await api.upsertLotPrivate({ lot_id: lot.id, budget: f.budget, budget_prices: {}, settings: DEFAULT_SETTINGS, awarded_offer_id: null })
          onCreated(lot.id)
        } catch (err) {
          setError(errorMessage(err))
          setBusy(false)
        }
      }}
    >
      <Field label="Nom du lot" htmlFor="l-name">
        <input id="l-name" className="field" required autoFocus placeholder="Ex. Gros œuvre" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Numéro du lot" htmlFor="l-code">
          <input id="l-code" className="field" placeholder="Ex. Lot 04" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        </Field>
        <Field label="Date de rendu des offres" htmlFor="l-due">
          <input id="l-due" type="date" min={todayIso()} className="field" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
        </Field>
      </div>
      <Field label="Budget objectif HT" htmlFor="l-budget" hint="Visible de vous seul : il sert de référence dans le comparatif.">
        <NumberInput id="l-budget" suffix="€" value={f.budget} onCommit={(v) => setF({ ...f, budget: v })} />
      </Field>
      {error && <p className="text-[14px] text-bad">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" disabled={busy || !f.name.trim()}>
          {busy && <Spinner />} Créer et saisir la DPGF
        </Button>
      </div>
    </form>
  )
}

// ————————————————————————— Entreprise —————————————————————————

function CompanyProject({ b }: { b: ProjectBundle }) {
  const { userId } = useAuth()
  const owner = b.owner
  const ownerName = owner?.company_name || [owner?.first_name, owner?.last_name].filter(Boolean).join(' ') || 'L’acheteur'
  return (
    <div className="flex flex-col gap-5">
      <Link to="/" className="inline-flex items-center gap-1 text-[14px] text-ink-2 hover:text-ink">
        <ChevronLeft size={16} /> Mes consultations
      </Link>
      <section className="cartouche">
        <div className="flex items-center gap-4 border-b border-ink/25 px-4 py-4 sm:px-5">
          <CompanyLogo name={ownerName} url={owner?.logo_url} size={52} />
          <div className="min-w-0">
            <h1 className="font-title text-[30px] leading-[1.05] font-bold sm:text-[36px]">{b.project.name}</h1>
            <p className="text-[14.5px] text-ink-2">
              Consultation lancée par <span className="font-medium text-ink">{ownerName}</span>
              {b.project.reference && <>, affaire {b.project.reference}</>}
            </p>
          </div>
        </div>
        {(b.project.description || owner) && (
          <div className="grid gap-3 px-4 py-3 text-[14.5px] sm:grid-cols-[1fr_auto] sm:px-5">
            <p className="whitespace-pre-line text-ink-2">{b.project.description || 'Pas de présentation.'}</p>
            {owner && (
              <p className="flex flex-col gap-0.5 text-[13.5px] sm:text-right">
                <span>{[owner.first_name, owner.last_name].filter(Boolean).join(' ')}</span>
                {owner.email && (
                  <a className="text-plan hover:underline" href={`mailto:${owner.email}`}>
                    {owner.email}
                  </a>
                )}
                {owner.phone && (
                  <a className="text-plan hover:underline" href={`tel:${owner.phone.replace(/\s/g, '')}`}>
                    {owner.phone}
                  </a>
                )}
              </p>
            )}
          </div>
        )}
      </section>

      <h2 className="font-title text-[26px] font-semibold">Lots à chiffrer</h2>
      {b.lots.length === 0 ? (
        <EmptyState title="Pas encore de lot publié">L’acheteur n’a pas encore mis de DPGF en ligne sur ce projet. Revenez un peu plus tard.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {b.lots.map((lot) => {
            const mine = b.offers.find((o) => o.lot_id === lot.id && o.company_id === userId)
            const days = daysUntil(lot.due_date)
            const closed = days != null && days < 0
            const due = dueLabel(days)
            const status = mine?.status === 'submitted' ? 'sent' : mine ? 'draft' : 'none'
            return (
              <li key={lot.id}>
                <Link to={`/p/${b.project.id}/l/${lot.id}`} className="panel group flex h-full flex-col gap-3 p-5 hover:border-ink-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[18px] font-semibold">{lot.name}</h3>
                      <p className="text-[13.5px] text-ink-3">{[lot.code, `${lineItemsCount(lot.items)} lignes`].filter(Boolean).join(', ')}</p>
                    </div>
                    <StatusPill status={status} />
                  </div>
                  <p className="text-[14px]">
                    Remise le <span className="num font-medium">{fmtDate(lot.due_date)}</span>{' '}
                    <span className={cx(due.tone === 'warn' ? 'font-medium text-warn' : 'text-ink-3')}>({due.text})</span>
                  </p>
                  <span className="mt-auto text-[14px] font-medium text-plan">
                    {closed ? 'Voir mon offre' : status === 'sent' ? 'Modifier mon offre' : status === 'draft' ? 'Continuer ma réponse' : 'Répondre'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function StatusPill({ status }: { status: 'none' | 'draft' | 'sent' }) {
  const s = {
    none: ['À chiffrer', 'bg-line-2 text-ink-2'],
    draft: ['Brouillon', 'bg-warn-soft text-warn'],
    sent: ['Offre envoyée', 'bg-good-soft text-good'],
  }[status]
  return <span className={cx('shrink-0 rounded-[3px] px-1.5 py-0.5 text-[12px] font-semibold', s[1])}>{s[0]}</span>
}
