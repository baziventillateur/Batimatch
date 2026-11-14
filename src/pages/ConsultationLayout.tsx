import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ChevronLeft, Copy, Download, FileSpreadsheet, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useConsultation, useStore } from '../store'
import { companyKey, linesOf, statusOf, STATUS_LABEL } from '../lib/calc'
import { daysUntil, fmtDate, fmtEur } from '../lib/format'
import { exportBlankDpgf, exportJson } from '../lib/io'
import type { Consultation } from '../lib/types'
import { ConsultationForm } from '../components/ConsultationForm'
import { Button, EmptyState, Menu, MenuItem, cx } from '../components/ui'

export const useC = () => useOutletContext<Consultation>()

export default function ConsultationLayout() {
  const { cid } = useParams()
  const c = useConsultation(cid)
  const update = useStore((s) => s.updateConsultation)
  const remove = useStore((s) => s.removeConsultation)
  const duplicate = useStore((s) => s.duplicateConsultation)
  const nav = useNavigate()
  const [editing, setEditing] = useState(false)

  const meta = useMemo(() => {
    if (!c) return null
    const lines = linesOf(c.items)
    return {
      lines: lines.length,
      pse: lines.filter((l) => l.item.scope === 'option').length,
      companies: new Set(c.offers.map((o) => companyKey(o.company))).size,
      days: daysUntil(c.dueDate),
      status: statusOf(c),
    }
  }, [c])

  if (!c || !meta) {
    return (
      <EmptyState title="Consultation introuvable" action={<Button onClick={() => nav('/')}>Retour aux consultations</Button>}>
        Elle a peut-être été supprimée, ou elle a été créée sur un autre appareil.
      </EmptyState>
    )
  }

  const tabs = [
    { to: 'dpgf', n: 1, label: 'DPGF', count: meta.lines ? `${meta.lines} ligne${meta.lines > 1 ? 's' : ''}` : 'à saisir' },
    { to: 'offres', n: 2, label: 'Offres', count: c.offers.length ? `${meta.companies} entreprise${meta.companies > 1 ? 's' : ''}` : 'aucune' },
    { to: 'comparatif', n: 3, label: 'Comparatif', count: meta.companies >= 2 ? 'prêt' : 'dès 2 offres' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print">
        <Link to="/" className="inline-flex items-center gap-1 text-[14px] text-ink-2 hover:text-ink">
          <ChevronLeft size={16} /> Consultations
        </Link>
      </div>

      {/* Cartouche */}
      <section className="cartouche" aria-label="Informations de la consultation">
        <div className="flex items-start justify-between gap-3 border-b border-ink/25 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h1 className="font-title text-[30px] leading-[1.05] font-bold sm:text-[36px]">{c.name}</h1>
            <p className="mt-1 truncate text-[14.5px] text-ink-2">{c.affaire || 'Affaire non renseignée'}</p>
          </div>
          <div className="no-print flex shrink-0 items-center gap-1">
            <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={() => setEditing(true)} className="hidden sm:inline-flex">
              Modifier
            </Button>
            <Menu label="Actions sur la consultation" icon={<MoreHorizontal size={18} />}>
              {(close) => (
                <>
                  <MenuItem icon={<Pencil />} onClick={() => (close(), setEditing(true))}>
                    Modifier les informations
                  </MenuItem>
                  <MenuItem icon={<FileSpreadsheet />} onClick={() => (close(), exportBlankDpgf(c))}>
                    DPGF vierge pour les entreprises (CSV)
                  </MenuItem>
                  <MenuItem
                    icon={<Copy />}
                    onClick={() => {
                      close()
                      const id = duplicate(c.id)
                      if (id) nav(`/c/${id}/dpgf`)
                    }}
                  >
                    Réutiliser le DPGF
                  </MenuItem>
                  <MenuItem icon={<Download />} onClick={() => (close(), exportJson([c], c.name))}>
                    Exporter la consultation
                  </MenuItem>
                  <MenuItem
                    icon={<Trash2 />}
                    danger
                    onClick={() => {
                      close()
                      if (confirm(`Supprimer « ${c.name} » et ses offres ? Cette action est définitive.`)) {
                        remove(c.id)
                        nav('/')
                      }
                    }}
                  >
                    Supprimer
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
                <span className={cx('ml-2 text-[13px] font-normal', meta.days >= 0 && meta.days <= 3 ? 'text-warn' : 'text-ink-3')}>
                  {meta.days > 0 ? `J−${meta.days}` : meta.days === 0 ? 'aujourd’hui' : `il y a ${-meta.days} j`}
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

      {/* Étapes */}
      <nav aria-label="Étapes" className="no-print -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ol className="flex min-w-max gap-1 border-b border-line">
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                className={({ isActive }) =>
                  cx(
                    '-mb-px flex items-center gap-2.5 border-b-[3px] px-3 py-2.5 sm:px-4',
                    isActive ? 'border-ink text-ink' : 'border-transparent text-ink-2 hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cx(
                        'num flex size-6 items-center justify-center rounded-full text-[13px] font-semibold',
                        isActive ? 'bg-ink text-white' : 'border border-ink-3 text-ink-2',
                      )}
                    >
                      {t.n}
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className="font-semibold">{t.label}</span>
                      <span className="text-[12.5px] text-ink-3">{t.count}</span>
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ol>
      </nav>

      <Outlet context={c} />

      <ConsultationForm
        open={editing}
        onClose={() => setEditing(false)}
        initial={c}
        title="Modifier la consultation"
        submitLabel="Enregistrer"
        onSubmit={(d) => {
          update(c.id, d)
          setEditing(false)
        }}
      />
    </div>
  )
}
