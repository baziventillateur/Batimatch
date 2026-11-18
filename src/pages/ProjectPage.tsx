import { useCallback, useEffect, useMemo, useState } from 'react'
import { REFRESH_EVENT } from '../components/Bell'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, Clock, Copy, EyeOff, Lock, Mail, MoreHorizontal, PauseCircle, Pencil, Phone, Plus, RotateCcw, Send, Share2, Sparkles, Trash2, UserMinus, X } from 'lucide-react'
import { api, errorMessage } from '../data'
import { useAuth } from '../data/auth'
import type { ProjectBundle } from '../data/backend'
import type { AccessStatus, LotStatus } from '../data/rows'
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

  // Une demande traitée depuis la cloche met la page à jour
  useEffect(() => {
    window.addEventListener(REFRESH_EVENT, load)
    return () => window.removeEventListener(REFRESH_EVENT, load)
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

      {b.project.is_example ? <ExampleBanner projectId={b.project.id} /> : <InvitePanel code={b.project.access_code} projectName={b.project.name} />}

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
          <ul className="panel">
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

/** Projet exemple : à la place du code d'invitation, qui ne sert à rien ici */
function ExampleBanner({ projectId }: { projectId: string }) {
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const reset = async () => {
    if (!confirm('Repartir d’un projet exemple neuf ? Vos modifications sur celui-ci seront perdues.')) return
    setBusy(true)
    try {
      await api.deleteProject(projectId)
      nav(`/p/${await api.openExampleProject()}`, { replace: true })
    } catch (e) {
      alert(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="flex items-start gap-2.5 rounded-md border border-plan/25 bg-plan-soft px-3.5 py-2.5 sm:px-5" aria-label="Projet exemple">
      <Sparkles size={17} className="mt-0.5 shrink-0 text-plan" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        <p className="min-w-0 flex-1 basis-[16rem] text-[0.875rem]">
          <strong className="font-semibold">Projet exemple</strong> : entreprises et montants fictifs, rien n’est envoyé. Acceptez, notez, attribuez librement.
        </p>
        <Button size="sm" variant="ghost" className="-ml-2 sm:ml-0" icon={busy ? <Spinner /> : <RotateCcw size={14} />} disabled={busy} onClick={reset}>
          Repartir de zéro
        </Button>
      </div>
    </section>
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
  const order: Record<AccessStatus, number> = { pending: 0, approved: 1, declined: 2, refused: 3 }
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
      <ul className="panel">
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
                  <span className="text-ink-3">{r.status === 'declined' ? 'ne répond pas à' : 'demande l’accès à'}</span>{' '}
                  <span className="font-medium">{lot?.name || 'un lot'}</span>
                </p>
                {r.status === 'declined' && r.comment && <p className="mt-0.5 text-[0.8438rem] italic text-ink-2">« {r.comment} »</p>}
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
                ) : r.status === 'declined' ? (
                  <Button size="sm" variant="ghost" disabled={busy === key} onClick={() => decide(r.lot_id, r.user_id, 'refused')}>
                    Refuser
                  </Button>
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
      <ul className="panel">
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
  const [declining, setDeclining] = useState<ProjectBundle['catalog'][number] | null>(null)
  const [reason, setReason] = useState('')
  const [declineBusy, setDeclineBusy] = useState(false)
  const submitDecline = async () => {
    if (!declining || reason.trim().length < 3) return
    setDeclineBusy(true)
    try {
      await api.declineLot(declining.id, reason)
      setDeclining(null)
      setReason('')
      reload()
    } catch (e) {
      alert(errorMessage(e))
    } finally {
      setDeclineBusy(false)
    }
  }
  const undecline = async (lotId: string) => {
    try {
      await api.undeclineLot(lotId)
      reload()
    } catch (e) {
      alert(errorMessage(e))
    }
  }
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
            const full = b.lots.find((l) => l.id === lot.id)
            const lines = linesOf(full?.items ?? [])
            const total = lines.length || lot.line_count
            const priced = mine ? lines.filter((l) => mine.prices?.[l.item.id] !== undefined).length : 0
            const access = lot.access
            // Étape en cours : 0 accès, 1 chiffrage, 2 envoi, 3 tout est fait
            const stage = !open ? 0 : status === 'sent' ? 3 : total > 0 && priced >= total ? 2 : 1
            const head = (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[1.125rem] font-semibold">{lot.name}</h3>
                  <p className="text-[0.8438rem] text-ink-2">
                    {[lot.code, open ? null : `${lot.line_count} ligne${lot.line_count > 1 ? 's' : ''}`, lot.due_date ? `remise le ${fmtDate(lot.due_date)}` : due.text]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
                {suspended ? <LotStatusPill status="suspended" /> : <DueChip days={days} sent={status === 'sent'} />}
              </div>
            )
            const steps =
              access === 'refused' || access === 'declined' ? null : (
                <LotSteps stage={stage} first={open ? 'Accès validé' : access === 'pending' ? 'Accès demandé' : 'Accès au lot'} />
              )
            return (
              <li key={lot.id}>
                {open ? (
                  <div className="panel flex h-full flex-col gap-3.5 p-4">
                    {head}
                    {steps}
                    <PricingBar done={priced} total={total} />
                    <div className="mt-auto flex flex-col gap-1">
                      <Link
                        to={`/p/${b.project.id}/l/${lot.id}`}
                        className={cx(
                          'inline-flex h-10 items-center justify-center rounded-[5px] border text-[0.9375rem] font-medium transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97]',
                          closed || status === 'sent' ? 'border-line bg-sheet text-ink hover:border-ink-3' : 'border-plan-dark/40 bg-plan text-sheet hover:bg-plan-dark',
                        )}
                      >
                        {closed ? 'Voir mon offre' : status === 'sent' ? 'Modifier mon offre' : priced > 0 || status === 'draft' ? 'Continuer ma réponse' : 'Répondre'}
                      </Link>
                      {!closed && status !== 'sent' && (
                        <Button size="sm" variant="ghost" className="self-center" onClick={() => setDeclining(lot)}>
                          Ne pas répondre
                        </Button>
                      )}
                    </div>
                  </div>
                ) : lot.access === 'declined' ? (
                  <div className="panel flex h-full flex-col gap-2.5 p-4">
                    {head}
                    <div className="mt-auto flex flex-col gap-2.5">
                      <p className="text-[0.875rem] text-ink-2">
                        Vous ne répondez pas à ce lot.
                        {b.access.find((a) => a.lot_id === lot.id && a.user_id === userId)?.comment && (
                          <span className="mt-1 block text-ink-3">
                            Motif transmis : « {b.access.find((a) => a.lot_id === lot.id && a.user_id === userId)?.comment} »
                          </span>
                        )}
                      </p>
                      {!closed && (
                        <Button size="sm" className="self-start" onClick={() => undecline(lot.id)}>
                          Revenir sur ma décision
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="panel flex h-full flex-col gap-3.5 p-4">
                    {head}
                    {!suspended && steps}
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
      <Dialog
        open={!!declining}
        onClose={() => setDeclining(null)}
        title="Ne pas répondre à ce lot"
        footer={
          <>
            <Button onClick={() => setDeclining(null)}>Annuler</Button>
            <Button variant="primary" disabled={declineBusy || reason.trim().length < 3} onClick={submitDecline}>
              Confirmer
            </Button>
          </>
        }
      >
        <p className="text-[0.9062rem] text-ink-2">
          Le motif est obligatoire et sera transmis à l’acheteur. Vous pourrez revenir sur cette décision tant que la remise n’est pas passée.
        </p>
        <label className="mt-3 flex flex-col gap-1.5 text-[0.875rem] font-medium">
          Motif
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Ex. : charge de travail, lot hors de notre périmètre, délai trop court…"
            className="w-full resize-none rounded-md border border-line bg-sheet px-3 py-2 text-[0.9375rem] font-normal focus:border-plan focus:outline-none"
          />
        </label>
      </Dialog>
    </div>
  )
}

/** Compte à rebours avant la remise : neutre, orange à J−3, rouge la veille et le jour même */
function DueChip({ days, sent }: { days: number | null; sent: boolean }) {
  if (days == null) return null
  if (days < 0) return <span className="shrink-0 rounded-[3px] bg-line-2 px-1.5 py-0.5 text-[0.75rem] font-semibold text-ink-2">Clôturé</span>
  const tone = days <= 1 ? 'bg-bad-soft text-bad' : days <= 3 ? 'bg-warn-soft text-warn' : 'bg-line-2 text-ink-2'
  return (
    <span className={cx('flex shrink-0 flex-col items-center rounded-[5px] px-2.5 py-1.5 leading-none', tone)}>
      <span className="num font-title text-[1.5rem] font-bold">{days === 0 ? 'Ce soir' : `J−${days}`}</span>
      <span className="mt-0.5 text-[0.7188rem] font-semibold">{days === 0 ? 'dernier délai' : sent ? 'pour modifier' : 'pour répondre'}</span>
    </span>
  )
}

/** Frise du lot côté entreprise : accès, chiffrage, envoi. `stage` est l'étape en cours (3 = tout est fait). */
function LotSteps({ stage, first }: { stage: number; first: string }) {
  const labels = [first, 'Chiffrage', 'Offre envoyée']
  return (
    <ol className="grid grid-cols-3" aria-label="Étapes du lot">
      {labels.map((label, i) => {
        const done = i < stage
        const current = i === stage
        return (
          <li key={i} className="relative flex flex-col items-center gap-1.5 text-center" aria-current={current ? 'step' : undefined}>
            {i > 0 && <span aria-hidden="true" className={cx('absolute top-[0.625rem] right-1/2 left-[-50%] h-0.5 -translate-y-1/2', done || current ? 'bg-good' : 'bg-line')} />}
            <span
              key={done ? 'done' : 'todo'}
              className={cx(
                'relative z-10 flex size-5 items-center justify-center rounded-full border-2',
                done ? 'anim-pop border-good bg-good text-sheet' : current ? 'border-plan bg-plan-soft' : 'border-line bg-sheet',
              )}
            >
              {done && <Check size={12} strokeWidth={3.5} aria-hidden="true" />}
            </span>
            <span className={cx('text-[0.7812rem] leading-tight', done ? 'font-medium text-ink' : current ? 'font-semibold text-plan-dark' : 'text-ink-2')}>
              {label}
              {done && <span className="sr-only"> (fait)</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Avancement du chiffrage : postes chiffrés sur le total du lot */
function PricingBar({ done, total }: { done: number; total: number }) {
  if (!total) return null
  const complete = done >= total
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-baseline justify-between gap-3 text-[0.875rem]">
        <span>
          <span className="num font-bold">{Math.min(done, total)}</span> poste{done > 1 ? 's' : ''} sur <span className="num">{total}</span> chiffré{done > 1 ? 's' : ''}
        </span>
        <span className={cx('text-[0.8125rem]', complete ? 'font-medium text-good' : 'text-ink-2')}>{complete ? 'complet' : `reste ${total - done}`}</span>
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-line-2" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(done, total)} aria-label="Postes chiffrés">
        <div className={cx('anim-grow h-full rounded-full', complete ? 'bg-good' : 'bg-plan')} style={{ width: `${Math.min(100, (done / total) * 100)}%` }} />
      </div>
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
