import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, Clock, Copy, EyeOff, Lock, Mail, MoreHorizontal, PauseCircle, Pencil, Phone, Plus, Send, Share2, Trash2, UserMinus, X } from 'lucide-react'
import { api, errorMessage } from '../data'
import { useAuth } from '../data/auth'
import type { ProjectBundle } from '../data/backend'
import type { LotStatus } from '../data/rows'
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
  return b.project.owner_id === profile.id ? <BuyerProject b={b} reload={load} /> : <CompanyProject b={b} reload={load} />
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
      <Link to="/" className="no-print inline-flex items-center gap-1 text-[0.875rem] text-ink-2 hover:text-ink">
        <ChevronLeft size={16} /> Mes projets
      </Link>

      <section className="cartouche" aria-label="Projet">
        <div className="flex items-start justify-between gap-3 border-b border-ink/25 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h1 className="font-title text-[1.875rem] leading-[1.05] font-bold sm:text-[2.25rem]">{b.project.name}</h1>
            <p className="mt-1 text-[0.9062rem] text-ink-2">{b.project.reference || 'Sans référence'}</p>
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
            <dd className="num text-[1.25rem] font-semibold">{b.lots.length}</dd>
          </div>
          <div className="cartouche-cell border-r">
            <dt className="cartouche-label">Entreprises inscrites</dt>
            <dd className="num text-[1.25rem] font-semibold">{b.members.length}</dd>
          </div>
          <div className="cartouche-cell">
            <dt className="cartouche-label">Offres reçues</dt>
            <dd className="num text-[1.25rem] font-semibold">{submitted.length}</dd>
          </div>
        </dl>
      </section>

      <InvitePanel code={b.project.access_code} projectName={b.project.name} />

      <AccessRequests b={b} reload={reload} />

      <section className="flex flex-col gap-3" aria-labelledby="lots-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="lots-title" className="font-title text-[1.625rem] font-semibold">
            Lots et demandes d’offre
          </h2>
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAddingLot(true)}>
            Nouveau lot
          </Button>
        </div>
        {b.lots.length === 0 ? (
          <EmptyState title="Aucun lot" action={<Button variant="primary" onClick={() => setAddingLot(true)}>Créer le premier lot</Button>}>
            Créez un lot par corps d’état : sa DPGF, sa date de rendu et son budget objectif (que les entreprises ne voient pas). Un lot reste invisible tant que vous ne le publiez pas.
          </EmptyState>
        ) : (
          <ul className="panel overflow-hidden">
            {b.lots.map((lot) => (
              <LotRow key={lot.id} b={b} lotId={lot.id} reload={reload} />
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

const LOT_STATUS: Record<LotStatus, { label: string; cls: string; icon: typeof Send }> = {
  draft: { label: 'Non publié', cls: 'bg-line-2 text-ink-2', icon: EyeOff },
  published: { label: 'Publié', cls: 'bg-good-soft text-good', icon: Send },
  suspended: { label: 'Suspendu', cls: 'bg-warn-soft text-warn', icon: PauseCircle },
}

export function LotStatusPill({ status }: { status: LotStatus }) {
  const s = LOT_STATUS[status]
  const Icon = s.icon
  return (
    <span key={status} className={cx('anim-pop inline-flex shrink-0 items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-[0.75rem] font-semibold', s.cls)}>
      <Icon size={12} /> {s.label}
    </span>
  )
}

function LotRow({ b, lotId, reload }: { b: ProjectBundle; lotId: string; reload: () => void }) {
  const lot = b.lots.find((l) => l.id === lotId)!
  const status: LotStatus = lot.status ?? 'published'
  const access = b.access.filter((a) => a.lot_id === lotId)
  const pending = access.filter((a) => a.status === 'pending').length
  const approved = access.filter((a) => a.status === 'approved').length
  const [busy, setBusy] = useState(false)
  const setStatus = async (next: LotStatus) => {
    if (next === 'draft' && !confirm(`Dépublier « ${lot.name} » ? Les entreprises ne le verront plus, même celles déjà acceptées.`)) return
    setBusy(true)
    try {
      await api.updateLot(lot.id, { status: next })
      reload()
    } catch (e) {
      alert(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
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
          <span className="block truncate text-[1.0625rem] font-semibold">{lot.name || 'Lot sans nom'}</span>
          <span className="block truncate text-[0.8438rem] text-ink-3">
            {[lot.code, `${lineItemsCount(lot.items)} ligne${lineItemsCount(lot.items) > 1 ? 's' : ''}`].filter(Boolean).join(', ')}
          </span>
        </span>
        <span className="text-right text-[0.875rem] md:text-left">
          <span className="num block">{fmtDate(lot.due_date)}</span>
          <span className={cx('block text-[0.7812rem]', due.tone === 'warn' ? 'font-medium text-warn' : 'text-ink-3')}>{due.text}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="flex -space-x-2">
            {companies.slice(0, 4).map((o) => (
              <CompanyLogo key={o.id} name={o.company_name || '?'} url={o.logo_url} size={28} className="ring-2 ring-sheet" />
            ))}
          </span>
          <span className="text-[0.875rem] text-ink-2">
            <span className="num font-semibold text-ink">{offers.length}</span> offre{offers.length > 1 ? 's' : ''}
          </span>
        </span>
        <span className="col-span-2 text-[0.875rem] md:col-span-1 md:text-right">
          {best != null ? (
            <>
              <span className="num font-semibold">{fmtEur(best)}</span>
              {budget ? <span className={cx('ml-2 text-[0.7812rem]', best > budget ? 'text-bad' : 'text-good')}>{fmtPctSigned(best / budget - 1)} budget</span> : null}
            </>
          ) : (
            <span className="text-ink-3">Aucun prix reçu</span>
          )}
        </span>
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2.5 sm:px-5">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.8125rem] text-ink-2">
          <LotStatusPill status={status} />
          {status !== 'draft' && (
            <span>
              <span className="num font-semibold text-ink">{approved}</span> entreprise{approved > 1 ? 's' : ''} acceptée{approved > 1 ? 's' : ''}
            </span>
          )}
          {pending > 0 && (
            <span className="font-medium text-warn">
              {pending} demande{pending > 1 ? 's' : ''} en attente
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          {status === 'draft' && (
            <Button size="sm" variant="primary" icon={<Send size={14} />} disabled={busy} onClick={() => setStatus('published')}>
              Publier
            </Button>
          )}
          {status === 'published' && (
            <Button size="sm" icon={<PauseCircle size={14} />} disabled={busy} onClick={() => setStatus('suspended')}>
              Suspendre
            </Button>
          )}
          {status === 'suspended' && (
            <Button size="sm" variant="primary" icon={<Send size={14} />} disabled={busy} onClick={() => setStatus('published')}>
              Reprendre
            </Button>
          )}
          {status !== 'draft' && (
            <Menu label={`Publication de ${lot.name}`} icon={<MoreHorizontal size={17} />}>
              {(close) => (
                <MenuItem icon={<EyeOff />} onClick={() => (close(), setStatus('draft'))}>
                  Dépublier (remettre en brouillon)
                </MenuItem>
              )}
            </Menu>
          )}
        </span>
      </div>
    </li>
  )
}

/** Demandes d'accès aux lots : l'acheteur accepte ou refuse chaque entreprise, lot par lot */
function AccessRequests({ b, reload }: { b: ProjectBundle; reload: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const order = { pending: 0, approved: 1, refused: 2 }
  const rows = [...b.access].sort((x, y) => order[x.status] - order[y.status] || y.requested_at.localeCompare(x.requested_at))
  if (!rows.length) return null
  const pending = rows.filter((r) => r.status === 'pending').length
  const decide = async (lotId: string, userId: string, status: 'approved' | 'refused') => {
    setBusy(`${lotId}:${userId}`)
    try {
      await api.decideLotAccess(lotId, userId, status)
      reload()
    } catch (e) {
      alert(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className="flex flex-col gap-3" aria-labelledby="access-title">
      <h2 id="access-title" className="flex items-center gap-2.5 font-title text-[1.625rem] font-semibold">
        Demandes d’accès
        {pending > 0 && <span className="num anim-pop rounded-full bg-warn px-2 py-0.5 font-sans text-[0.8125rem] font-semibold text-sheet">{pending}</span>}
      </h2>
      <ul className="panel overflow-hidden">
        {rows.map((r) => {
          const p = b.members.find((m) => m.user_id === r.user_id)?.profile
          const lot = b.lots.find((l) => l.id === r.lot_id)
          const name = p?.company_name || 'Entreprise'
          const key = `${r.lot_id}:${r.user_id}`
          return (
            <li key={key} className={cx('flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-2 px-4 py-2.5 last:border-0 sm:px-5', r.status === 'pending' && 'bg-warn-soft/40')}>
              <CompanyLogo name={name} url={p?.logo_url} size={36} />
              <div className="min-w-[9rem] flex-1">
                <p className="font-semibold leading-snug">{name}</p>
                <p className="text-[0.8438rem] leading-snug">
                  <span className="text-ink-3">demande l’accès à</span> <span className="font-medium">{lot?.name || 'un lot'}</span>
                </p>
                <p className="flex flex-wrap gap-x-3 text-[0.8125rem] text-ink-2">
                  <span>{[p?.first_name, p?.last_name].filter(Boolean).join(' ')}</span>
                  {p?.email && (
                    <a href={`mailto:${p.email}`} className="text-plan hover:underline">
                      {p.email}
                    </a>
                  )}
                  {p?.phone && (
                    <a href={`tel:${p.phone.replace(/\s/g, '')}`} className="text-plan hover:underline">
                      {p.phone}
                    </a>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {r.status === 'pending' ? (
                  <>
                    <Button size="sm" icon={<X size={14} />} disabled={busy === key} onClick={() => decide(r.lot_id, r.user_id, 'refused')}>
                      Refuser
                    </Button>
                    <Button size="sm" variant="primary" icon={<Check size={14} />} disabled={busy === key} onClick={() => decide(r.lot_id, r.user_id, 'approved')}>
                      Accepter
                    </Button>
                  </>
                ) : r.status === 'approved' ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-good">
                      <Check size={14} /> Acceptée
                    </span>
                    <Button size="sm" variant="ghost" disabled={busy === key} onClick={() => confirm(`Retirer l’accès de ${name} à ce lot ?`) && decide(r.lot_id, r.user_id, 'refused')}>
                      Retirer
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-[0.8125rem] text-ink-3">Refusée</span>
                    <Button size="sm" variant="ghost" disabled={busy === key} onClick={() => decide(r.lot_id, r.user_id, 'approved')}>
                      Accepter
                    </Button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function InvitePanel({ code, projectName }: { code: string; projectName: string }) {
  const [copied, setCopied] = useState<string | null>(null)
  const link = `${window.location.origin}${window.location.pathname}#/rejoindre/${code}`
  const message = `Bonjour,\n\nNous vous invitons à remettre une offre pour le projet « ${projectName} » sur Batimatch.\n\n1. Créez votre compte entreprise : ${link}\n2. Le projet s’ouvre automatiquement (code d’accès : ${code}).\n3. Demandez l’accès aux lots qui vous concernent : nous validons votre demande.\n\nVous pourrez ensuite consulter les DPGF, saisir vos prix et modifier votre offre jusqu’à la date de rendu.\n\nCordialement,`
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
        <p className="max-w-[52ch] text-[0.875rem] text-ink-2">
          Transmettez ce code ou le lien d’invitation : l’entreprise crée son compte, voit la liste des lots publiés et demande l’accès à ceux qui la concernent. Vous validez chaque demande. Elle ne verra ni votre budget ni les autres offres.
        </p>
      </div>
      <div className="flex flex-col items-start gap-2.5 sm:items-end">
        <button
          type="button"
          onClick={() => copy(code, 'code')}
          className="num rounded-md border-2 border-ink bg-sheet px-4 py-1.5 text-[1.875rem] leading-tight font-semibold tracking-[0.3em] transition-transform active:scale-95"
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
        {copied === 'code' && <span className="anim-pop text-[0.8125rem] font-medium text-good">Code copié</span>}
      </div>
    </section>
  )
}

function Members({ b, reload }: { b: ProjectBundle; reload: () => void }) {
  if (!b.members.length) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="font-title text-[1.625rem] font-semibold">Entreprises inscrites</h2>
        <p className="panel px-5 py-4 text-ink-2">Aucune entreprise n’a encore rejoint le projet. Partagez le code ci-dessus.</p>
      </section>
    )
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-title text-[1.625rem] font-semibold">Entreprises inscrites</h2>
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
                <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-[0.8438rem] text-ink-2">
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
                <p className="text-[0.7812rem] text-ink-3">
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
      {error && <p className="text-[0.875rem] text-bad">{error}</p>}
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

function CompanyProject({ b, reload }: { b: ProjectBundle; reload: () => void }) {
  const { userId } = useAuth()
  const [asking, setAsking] = useState<string | null>(null)
  const owner = b.owner
  const ownerName = owner?.company_name || [owner?.first_name, owner?.last_name].filter(Boolean).join(' ') || 'L’acheteur'
  return (
    <div className="flex flex-col gap-5">
      <Link to="/" className="inline-flex items-center gap-1 text-[0.875rem] text-ink-2 hover:text-ink">
        <ChevronLeft size={16} /> Mes consultations
      </Link>
      <section className="cartouche">
        <div className="flex items-center gap-4 border-b border-ink/25 px-4 py-4 sm:px-5">
          <CompanyLogo name={ownerName} url={owner?.logo_url} size={52} />
          <div className="min-w-0">
            <h1 className="font-title text-[1.875rem] leading-[1.05] font-bold sm:text-[2.25rem]">{b.project.name}</h1>
            <p className="text-[0.9062rem] text-ink-2">
              Consultation lancée par <span className="font-medium text-ink">{ownerName}</span>
              {b.project.reference && <>, affaire {b.project.reference}</>}
            </p>
          </div>
        </div>
        {(b.project.description || owner) && (
          <div className="grid gap-3 px-4 py-3 text-[0.9062rem] sm:grid-cols-[1fr_auto] sm:px-5">
            <p className="whitespace-pre-line text-ink-2">{b.project.description || 'Pas de présentation.'}</p>
            {owner && (
              <p className="flex flex-col gap-0.5 text-[0.8438rem] sm:text-right">
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

      <h2 className="font-title text-[1.625rem] font-semibold">Lots de la consultation</h2>
      {b.catalog.length === 0 ? (
        <EmptyState title="Pas encore de lot publié">L’acheteur n’a pas encore publié de lot sur ce projet. Revenez un peu plus tard.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {b.catalog.map((lot) => {
            const open = lot.access === 'approved' && b.lots.some((l) => l.id === lot.id)
            const mine = b.offers.find((o) => o.lot_id === lot.id && o.company_id === userId)
            const days = daysUntil(lot.due_date)
            const suspended = lot.status === 'suspended'
            const closed = suspended || (days != null && days < 0)
            const due = dueLabel(days)
            const status = mine?.status === 'submitted' ? 'sent' : mine ? 'draft' : 'none'
            const head = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[1.125rem] font-semibold">{lot.name}</h3>
                    <p className="text-[0.8438rem] text-ink-3">{[lot.code, `${lot.line_count} ligne${lot.line_count > 1 ? 's' : ''}`].filter(Boolean).join(', ')}</p>
                  </div>
                  {suspended ? <LotStatusPill status="suspended" /> : open ? <StatusPill status={status} /> : null}
                </div>
                <p className="text-[0.875rem]">
                  Remise le <span className="num font-medium">{fmtDate(lot.due_date)}</span>{' '}
                  <span className={cx(due.tone === 'warn' ? 'font-medium text-warn' : 'text-ink-3')}>({due.text})</span>
                </p>
              </>
            )
            return (
              <li key={lot.id}>
                {open ? (
                  <Link to={`/p/${b.project.id}/l/${lot.id}`} className="panel group flex h-full flex-col gap-2.5 p-4 hover:border-ink-3">
                    {head}
                    <span className="mt-auto text-[0.875rem] font-medium text-plan">
                      {closed ? 'Voir mon offre' : status === 'sent' ? 'Modifier mon offre' : status === 'draft' ? 'Continuer ma réponse' : 'Répondre'}
                    </span>
                  </Link>
                ) : (
                  <div className="panel flex h-full flex-col gap-2.5 p-4">
                    {head}
                    <div className="mt-auto">
                      {lot.access === 'pending' ? (
                        <p key="pending" className="anim-pop inline-flex items-center gap-1.5 rounded-[4px] bg-warn-soft px-2 py-1 text-[0.8438rem] font-medium text-warn">
                          <Clock size={14} /> Demande envoyée, en attente de validation
                        </p>
                      ) : lot.access === 'refused' ? (
                        <p className="inline-flex items-center gap-1.5 text-[0.8438rem] text-ink-3">
                          <Lock size={14} /> Accès non accordé par l’acheteur
                        </p>
                      ) : suspended ? (
                        <p className="text-[0.8438rem] text-ink-3">Consultation suspendue : les demandes d’accès sont fermées.</p>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<Send size={14} />}
                          disabled={asking === lot.id}
                          onClick={async () => {
                            setAsking(lot.id)
                            try {
                              await api.requestLotAccess(lot.id)
                              reload()
                            } catch (e) {
                              alert(errorMessage(e))
                            } finally {
                              setAsking(null)
                            }
                          }}
                        >
                          Demander l’accès
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-[0.8125rem] text-ink-3">Le DPGF d’un lot s’ouvre dès que l’acheteur a validé votre demande.</p>
    </div>
  )
}

export function StatusPill({ status }: { status: 'none' | 'draft' | 'sent' }) {
  const s = {
    none: ['À chiffrer', 'bg-line-2 text-ink-2'],
    draft: ['Brouillon', 'bg-warn-soft text-warn'],
    sent: ['Offre envoyée', 'bg-good-soft text-good'],
  }[status]
  return <span className={cx('shrink-0 rounded-[3px] px-1.5 py-0.5 text-[0.75rem] font-semibold', s[1])}>{s[0]}</span>
}
