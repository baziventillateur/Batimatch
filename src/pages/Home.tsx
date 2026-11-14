import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Download, FileUp, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { newConsultation, useStore } from '../store'
import { analyze, companyKey, linesOf, statusOf, STATUS_LABEL, type ConsultationStatus } from '../lib/calc'
import { daysUntil, fmtDate, fmtEur, fmtPctSigned } from '../lib/format'
import { buildDemo } from '../lib/demo'
import { exportJson, parseImport } from '../lib/io'
import { ConsultationForm } from '../components/ConsultationForm'
import { Button, Menu, MenuItem, cx } from '../components/ui'
import type { Consultation } from '../lib/types'

export default function Home() {
  const consultations = useStore((s) => s.consultations)
  const add = useStore((s) => s.addConsultation)
  const remove = useStore((s) => s.removeConsultation)
  const duplicate = useStore((s) => s.duplicateConsultation)
  const merge = useStore((s) => s.mergeConsultations)
  const nav = useNavigate()
  const [creating, setCreating] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const openDemo = () => {
    const demo = buildDemo()
    add(demo)
    nav(`/c/${demo.id}/comparatif`)
  }

  const onImport = async (file: File) => {
    try {
      const list = parseImport(await file.text())
      merge(list)
      setImportError(null)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import impossible.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-title text-[34px] leading-none font-bold sm:text-[40px]">Consultations</h1>
          <p className="mt-2 text-ink-2">Un DPGF, les offres des entreprises, et le comparatif pour décider.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {consultations.length > 0 && (
            <Button variant="ghost" onClick={openDemo}>
              Ouvrir l’exemple
            </Button>
          )}
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => setCreating(true)}>
            Nouvelle consultation
          </Button>
        </div>
      </div>

      {consultations.length === 0 ? (
        <Onboarding onCreate={() => setCreating(true)} onDemo={openDemo} />
      ) : (
        <ConsultationList
          items={consultations}
          onOpen={(c) => nav(`/c/${c.id}/${c.offers.length >= 2 ? 'comparatif' : linesOf(c.items).length ? 'offres' : 'dpgf'}`)}
          onDuplicate={(c) => {
            const id = duplicate(c.id)
            if (id) nav(`/c/${id}/dpgf`)
          }}
          onExport={(c) => exportJson([c], c.name)}
          onRemove={(c) => {
            if (confirm(`Supprimer « ${c.name} » et ses ${c.offers.length} offre(s) ? Cette action est définitive.`)) remove(c.id)
          }}
        />
      )}

      <section className="no-print flex flex-col gap-3 border-t border-line pt-5 text-[14px] text-ink-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[62ch]">
          Vos données restent dans ce navigateur, sur cet appareil. Exportez une sauvegarde pour les conserver ou les
          transférer.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<Download size={15} />} disabled={!consultations.length} onClick={() => exportJson(consultations)}>
            Exporter la sauvegarde
          </Button>
          <Button size="sm" icon={<FileUp size={15} />} onClick={() => fileRef.current?.click()}>
            Importer
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImport(f)
              e.target.value = ''
            }}
          />
        </div>
      </section>
      {importError && <p className="text-[14px] text-bad">{importError}</p>}

      <ConsultationForm
        open={creating}
        onClose={() => setCreating(false)}
        title="Nouvelle consultation"
        submitLabel="Créer et saisir le DPGF"
        onSubmit={(d) => {
          const c = newConsultation(d)
          add(c)
          setCreating(false)
          nav(`/c/${c.id}/dpgf`)
        }}
      />
    </div>
  )
}

function Onboarding({ onCreate, onDemo }: { onCreate: () => void; onDemo: () => void }) {
  const steps = [
    ['Le DPGF', 'Désignations, unités et quantités. Collez-le depuis Excel en une fois.'],
    ['Les offres', 'Saisissez les prix unitaires de chaque entreprise, ses variantes et ses options.'],
    ['Le comparatif', 'Classement, écarts au budget, prix anormaux et lignes oubliées : de quoi arbitrer.'],
  ]
  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <div className="panel flex flex-col justify-between gap-6 p-6 sm:p-8">
        <div>
          <h2 className="font-title text-[28px] leading-tight font-semibold">Comparez vos offres en trois temps</h2>
          <ol className="mt-5 grid gap-4">
            {steps.map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[2.25rem_1fr] gap-3">
                <span className="num flex size-9 items-center justify-center rounded-full border border-ink/70 text-[17px] font-semibold">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{t}</p>
                  <p className="text-ink-2">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Plus size={18} />} onClick={onCreate}>
            Créer ma première consultation
          </Button>
          <Button onClick={onDemo}>Ouvrir l’exemple (lot VRD)</Button>
        </div>
      </div>
      <DemoPreview />
    </div>
  )
}

/** Aperçu statique de ce que produit le comparatif */
function DemoPreview() {
  const rows = [
    { n: 'TP Val-de-Seine', v: 371569, best: true },
    { n: 'Bitumes & Bordures', v: 377563 },
    { n: 'Réseaux Île-de-France', v: 390234 },
  ]
  const max = 400000
  return (
    <div className="panel hidden flex-col gap-4 p-6 sm:flex sm:p-8" aria-hidden="true">
      <p className="text-[14px] text-ink-3">Aperçu du comparatif, lot VRD</p>
      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.n} className="grid gap-1">
            <div className="flex justify-between text-[14px]">
              <span className={cx(r.best && 'font-semibold')}>{r.n}</span>
              <span className={cx('num', r.best && 'marker font-semibold')}>{fmtEur(r.v)}</span>
            </div>
            <div className="relative h-2.5 rounded-full bg-line-2">
              <div className="h-full rounded-full bg-s1" style={{ width: `${(r.v / max) * 100}%`, opacity: r.best ? 1 : 0.55 }} />
              <div className="absolute inset-y-[-4px] w-0.5 bg-ink" style={{ left: `${(375000 / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[13.5px] text-ink-2">
        Le trait noir marque le budget. Réseaux Île-de-France paraissait moins cher avant la remise à niveau de deux lignes
        non chiffrées.
      </p>
    </div>
  )
}

const STATUS_STYLE: Record<ConsultationStatus, string> = {
  preparation: 'bg-line-2 text-ink-2',
  waiting: 'bg-warn-soft text-warn',
  analysis: 'bg-plan-soft text-plan-dark',
  awarded: 'bg-good-soft text-good',
}

function ConsultationList({
  items,
  onOpen,
  onDuplicate,
  onExport,
  onRemove,
}: {
  items: Consultation[]
  onOpen: (c: Consultation) => void
  onDuplicate: (c: Consultation) => void
  onExport: (c: Consultation) => void
  onRemove: (c: Consultation) => void
}) {
  const rows = useMemo(
    () =>
      items.map((c) => {
        const a = analyze(c)
        const companies = new Set(c.offers.map((o) => companyKey(o.company))).size
        return { c, a, companies, status: statusOf(c), days: daysUntil(c.dueDate) }
      }),
    [items],
  )
  return (
    <div className="panel overflow-hidden">
      <div className="hidden grid-cols-[minmax(0,2.2fr)_1fr_0.8fr_1.3fr_auto] gap-4 border-b border-line bg-paper/60 px-5 py-2.5 text-[13px] text-ink-3 md:grid">
        <span>Consultation</span>
        <span>Remise des offres</span>
        <span>Offres</span>
        <span>Moins-disant</span>
        <span className="w-9" />
      </div>
      <ul>
        {rows.map(({ c, a, companies, status, days }) => (
          <li key={c.id} className="border-b border-line-2 last:border-0">
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-paper/50 sm:px-5 md:grid-cols-[minmax(0,2.2fr)_1fr_0.8fr_1.3fr_auto]">
              <button type="button" onClick={() => onOpen(c)} className="min-w-0 text-left">
                <span className="block truncate text-[17px] font-semibold">{c.name}</span>
                <span className="block truncate text-[13.5px] text-ink-3">
                  {[c.affaire, c.lot].filter(Boolean).join(', ') || 'Sans affaire'}
                </span>
                <span className={cx('mt-1.5 inline-block rounded-[3px] px-1.5 py-0.5 text-[12px] font-medium', STATUS_STYLE[status])}>
                  {STATUS_LABEL[status]}
                </span>
              </button>
              <div className="row-span-1 md:hidden">
                <RowMenu c={c} onDuplicate={onDuplicate} onExport={onExport} onRemove={onRemove} />
              </div>
              <button type="button" onClick={() => onOpen(c)} className="col-span-2 grid grid-cols-3 gap-3 text-left text-[14px] md:col-span-3 md:grid-cols-[1fr_0.8fr_1.3fr] md:gap-4">
                <span>
                  <span className="block text-[12px] text-ink-3 md:hidden">Remise</span>
                  <span className="num">{fmtDate(c.dueDate)}</span>
                  {days != null && status !== 'awarded' && (
                    <span className={cx('block text-[12.5px]', days < 0 ? 'text-ink-3' : days <= 3 ? 'font-medium text-warn' : 'text-ink-3')}>
                      {days > 0 ? `dans ${days} j` : days === 0 ? 'aujourd’hui' : `il y a ${-days} j`}
                    </span>
                  )}
                </span>
                <span>
                  <span className="block text-[12px] text-ink-3 md:hidden">Offres</span>
                  <span className="num">{companies}</span>
                  <span className="text-ink-3"> entreprise{companies > 1 ? 's' : ''}</span>
                  {c.offers.length > companies && <span className="block text-[12.5px] text-ink-3">{c.offers.length} réponses</span>}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] text-ink-3 md:hidden">Moins-disant</span>
                  {a.best ? (
                    <>
                      <span className="num font-semibold">{fmtEur(a.best.total)}</span>
                      <span className="block truncate text-[12.5px] text-ink-3">{a.best.label}</span>
                      {a.bestVsBudget != null && (
                        <span className={cx('block text-[12.5px]', a.bestVsBudget > 0 ? 'text-bad' : 'text-good')}>
                          {fmtPctSigned(a.bestVsBudget)} par rapport au budget
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </span>
              </button>
              <div className="hidden md:block">
                <RowMenu c={c} onDuplicate={onDuplicate} onExport={onExport} onRemove={onRemove} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RowMenu({
  c,
  onDuplicate,
  onExport,
  onRemove,
}: {
  c: Consultation
  onDuplicate: (c: Consultation) => void
  onExport: (c: Consultation) => void
  onRemove: (c: Consultation) => void
}) {
  return (
    <Menu label={`Actions pour ${c.name}`} icon={<MoreHorizontal size={18} />}>
      {(close) => (
        <>
          <MenuItem icon={<Copy />} onClick={() => (close(), onDuplicate(c))}>
            Réutiliser le DPGF
          </MenuItem>
          <MenuItem icon={<Download />} onClick={() => (close(), onExport(c))}>
            Exporter cette consultation
          </MenuItem>
          <MenuItem icon={<Trash2 />} danger onClick={() => (close(), onRemove(c))}>
            Supprimer
          </MenuItem>
        </>
      )}
    </Menu>
  )
}
