import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { AlertTriangle, Check, ChevronLeft, EyeOff, FileSpreadsheet, Lock, MoreHorizontal, PauseCircle, Pencil, Send, Trash2 } from 'lucide-react'
import { useConsultation, useStore } from '../store'
import { api, errorMessage } from '../data'
import { useAuth } from '../data/auth'
import { loadLot, startLotSync, useSync } from '../data/sync'
import { companyKey, linesOf, statusOf, STATUS_LABEL } from '../lib/calc'
import { daysUntil, fmtDate, fmtEur } from '../lib/format'
import { exportBlankDpgf } from '../lib/io'
import type { Consultation } from '../lib/types'
import { Button, Dialog, ErrorBox, Field, Loading, Menu, MenuItem, NumberInput, Spinner, cx } from '../components/ui'

export const useC = () => useOutletContext<Consultation>()

/** Indicateur d'enregistrement automatique */
export function SaveIndicator() {
  const { status, error, retry } = useSync()
  if (status === 'idle') return null
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-bad" role="alert">
        <AlertTriangle size={14} /> {error}
        {retry && (
          <button type="button" className="font-medium underline" onClick={retry}>
            Réessayer
          </button>
        )}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-3" role="status">
      {status === 'saving' ? (
        <>
          <span className="anim-breathe size-2 rounded-full bg-plan" /> Enregistrement…
        </>
      ) : (
        <>
          <Check size={14} className="text-good" /> Enregistré
        </>
      )}
    </span>
  )
}

export default function ConsultationLayout() {
  const { cid = '', pid = '' } = useParams()
  const { userId } = useAuth()
  const c = useConsultation(cid)
  const update = useStore((s) => s.updateConsultation)
  const drop = useStore((s) => s.dropConsultation)
  const nav = useNavigate()
  const loc = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const syncRef = useRef<ReturnType<typeof startLotSync> | null>(null)

  useEffect(() => {
    let alive = true
    setError(null)
    useSync.setState({ status: 'idle', error: null })
    loadLot(cid)
      .then(() => {
        if (alive && userId) syncRef.current = startLotSync(cid, 'buyer', userId)
      })
      .catch((e) => alive && setError(errorMessage(e)))
    return () => {
      alive = false
      syncRef.current?.stop()
      syncRef.current = null
    }
  }, [cid, userId])

  const meta = useMemo(() => {
    if (!c) return null
    const lines = linesOf(c.items)
    return {
      lines: lines.length,
      companies: new Set(c.offers.map((o) => companyKey(o.company))).size,
      days: daysUntil(c.dueDate),
      status: statusOf(c),
    }
  }, [c])

  if (error) return <ErrorBox message={error} onRetry={() => nav(0)} />
  if (!c || !meta) return <Loading label="Chargement du lot" />

  const isSynthese = loc.pathname.endsWith('/synthese')
  if (isSynthese) return <Outlet context={c} />

  const tabs = [
    { to: 'dpgf', n: 1, done: meta.lines > 0, label: 'DPGF', count: meta.lines ? `${meta.lines} ligne${meta.lines > 1 ? 's' : ''}` : 'à saisir' },
    { to: 'offres', n: 2, done: c.offers.length > 0, label: 'Offres', count: c.offers.length ? `${meta.companies} entreprise${meta.companies > 1 ? 's' : ''}` : 'aucune' },
    { to: 'comparatif', n: 3, done: meta.companies >= 2, label: 'Comparatif', count: meta.companies >= 2 ? 'prêt' : 'dès 2 offres' },
    { to: 'decision', n: 4, done: !!c.awardedOfferId, label: 'Décision', count: c.awardedOfferId ? 'offre retenue' : meta.companies >= 2 ? 'à arbitrer' : 'dès 2 offres' },
  ]

  return (
    <div className="flex flex-col gap-3 sm:gap-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link to={`/p/${pid}`} className="inline-flex items-center gap-1 text-[0.875rem] text-ink-2 hover:text-ink">
          <ChevronLeft size={16} /> {c.affaire || 'Projet'}
        </Link>
        {c.locked ? (
          <Link to={`/p/${pid}`} className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-[0.8125rem] font-semibold text-warn" title="Déverrouiller depuis la page du projet">
            <Lock size={13} /> Verrouillé, consultation seule
          </Link>
        ) : (
          <SaveIndicator />
        )}
      </div>

      <section className="cartouche" aria-label="Informations du lot">
        <div className="flex items-start justify-between gap-3 border-b border-ink/25 px-3 py-2 sm:px-5 sm:py-3">
          <div className="min-w-0">
            <h1 className="font-title text-[1.5rem] leading-[1.05] font-bold sm:text-[2.25rem]">{c.name || 'Lot sans nom'}</h1>
            <p className="mt-0.5 truncate text-[0.875rem] text-ink-2">{c.affaire}</p>
          </div>
          <div className="no-print flex shrink-0 items-center gap-1">
            <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={() => setEditing(true)} className="max-sm:hidden">
              Modifier
            </Button>
            <Menu label="Actions sur le lot" icon={<MoreHorizontal size={18} />}>
              {(close) => (
                <>
                  <MenuItem icon={<Pencil />} onClick={() => (close(), setEditing(true))}>
                    Modifier le lot
                  </MenuItem>
                  <MenuItem icon={<FileSpreadsheet />} onClick={() => (close(), exportBlankDpgf(c))}>
                    DPGF vierge (CSV)
                  </MenuItem>
                  <MenuItem
                    icon={<Trash2 />}
                    danger
                    onClick={async () => {
                      close()
                      if (!confirm(`Supprimer le lot « ${c.name} » et ses ${c.offers.length} offre(s) ? Cette action est définitive.`)) return
                      try {
                        syncRef.current?.stop()
                        syncRef.current = null
                        await api.deleteLot(c.id)
                        drop(c.id)
                        nav(`/p/${pid}`)
                      } catch (e) {
                        alert(errorMessage(e))
                      }
                    }}
                  >
                    Supprimer le lot
                  </MenuItem>
                </>
              )}
            </Menu>
          </div>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4">
          <div className="cartouche-cell border-r border-b md:border-b-0">
            <dt className="cartouche-label">Lot</dt>
            <dd className="truncate font-medium">{c.lot || '—'}</dd>
          </div>
          <div className="cartouche-cell border-b md:border-r md:border-b-0">
            <dt className="cartouche-label">Remise des offres</dt>
            <dd className="num font-medium">
              {fmtDate(c.dueDate)}
              {meta.days != null && meta.status !== 'awarded' && (
                <span className={cx('ml-2 text-[0.8125rem] font-normal', meta.days >= 0 && meta.days <= 3 ? 'text-warn' : 'text-ink-3')}>
                  {meta.days > 0 ? `J−${meta.days}` : meta.days === 0 ? 'ce soir' : 'clôturé'}
                </span>
              )}
            </dd>
          </div>
          <div className="cartouche-cell border-r">
            <dt className="cartouche-label">Budget objectif HT</dt>
            <dd className="num font-medium">{c.budget ? fmtEur(c.budget) : '—'}</dd>
          </div>
          <div className="cartouche-cell">
            <dt className="cartouche-label">État</dt>
            <dd className="font-medium">{STATUS_LABEL[meta.status]}</dd>
          </div>
        </dl>
      </section>

      {c.status !== 'published' && (
        <div className="no-print anim-fade flex flex-wrap items-center justify-between gap-2 rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-[0.875rem]">
          <span className="flex items-center gap-2">
            {c.status === 'draft' ? <EyeOff size={16} className="shrink-0 text-warn" /> : <PauseCircle size={16} className="shrink-0 text-warn" />}
            {c.status === 'draft'
              ? 'Lot non publié : les entreprises ne le voient pas encore.'
              : 'Lot suspendu : les entreprises le voient, mais ne peuvent plus modifier leur offre.'}
          </span>
          <Button
            size="sm"
            variant="primary"
            icon={<Send size={14} />}
            onClick={async () => {
              try {
                await api.updateLot(c.id, { status: 'published' })
                update(c.id, { status: 'published' })
              } catch (e) {
                alert(errorMessage(e))
              }
            }}
          >
            {c.status === 'draft' ? 'Publier le lot' : 'Reprendre la consultation'}
          </Button>
        </div>
      )}

      <nav aria-label="Étapes" className="no-print -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <ol className="flex min-w-max gap-1 border-b border-line">
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                className={({ isActive }) =>
                  cx('-mb-px flex items-center gap-2 border-b-[3px] px-2.5 py-2 sm:px-4', isActive ? 'border-ink text-ink' : 'border-transparent text-ink-2 hover:text-ink')
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cx(
                        'num flex size-5 items-center justify-center rounded-full text-[0.75rem] font-semibold transition-colors',
                        isActive ? 'bg-ink text-sheet' : t.done ? 'bg-good-soft text-good' : 'border border-ink-3 text-ink-2',
                      )}
                    >
                      {t.done && !isActive ? <Check key="ok" size={12} strokeWidth={3} className="anim-pop" /> : t.n}
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className="font-semibold">{t.label}</span>
                      <span className="text-[0.7812rem] text-ink-3">{t.count}</span>
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ol>
      </nav>

      <Outlet context={c} />

      <Dialog open={editing} onClose={() => setEditing(false)} title="Modifier le lot">
        {editing && (
          <LotEditForm
            c={c}
            onClose={() => setEditing(false)}
            onSave={(patch) => {
              update(c.id, patch)
              setEditing(false)
            }}
          />
        )}
      </Dialog>
    </div>
  )
}

function LotEditForm({ c, onClose, onSave }: { c: Consultation; onClose: () => void; onSave: (p: Partial<Consultation>) => void }) {
  const [f, setF] = useState({ name: c.name, lot: c.lot, dueDate: c.dueDate, budget: c.budget, description: c.description })
  const [busy] = useState(false)
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...f, name: f.name.trim() })
      }}
    >
      <Field label="Nom du lot" htmlFor="le-name">
        <input id="le-name" className="field" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Numéro du lot" htmlFor="le-code">
          <input id="le-code" className="field" value={f.lot} onChange={(e) => setF({ ...f, lot: e.target.value })} />
        </Field>
        <Field label="Date de rendu" htmlFor="le-due" hint="La repousser rouvre la saisie aux entreprises.">
          <input id="le-due" type="date" className="field" value={f.dueDate ?? ''} onChange={(e) => setF({ ...f, dueDate: e.target.value || null })} />
        </Field>
      </div>
      <Field label="Budget objectif HT" htmlFor="le-budget" hint="Visible de vous seul.">
        <NumberInput id="le-budget" suffix="€" value={f.budget} onCommit={(v) => setF({ ...f, budget: v })} />
      </Field>
      <Field label="Consignes pour les entreprises" htmlFor="le-desc" hint="Pièces du DCE, visite, hypothèses… visibles des entreprises.">
        <textarea id="le-desc" rows={3} className="field resize-y" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" disabled={busy || !f.name.trim()}>
          {busy && <Spinner />} Enregistrer
        </Button>
      </div>
    </form>
  )
}
