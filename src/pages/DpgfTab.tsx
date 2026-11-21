import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, FileUp,
  ArrowDown,
  ArrowUp,
  ClipboardPaste,
  FileSpreadsheet,
  Heading,
  ListOrdered,
  MoreVertical,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react'
import { api, errorMessage } from '../data'
import { useC } from './ConsultationLayout'
import { newItem, useStore } from '../store'
import { linesOf } from '../lib/calc'
import { UNITS, guessDpgfColumns, rowsToItems, splitClipboard, type ColumnRole } from '../lib/parse'
import { exportBlankDpgf } from '../lib/io'
import { fmtEur } from '../lib/format'
import type { DpgfItem } from '../lib/types'
import { AnimatedNumber, Button, Descriptif, Dialog, EmptyState, Menu, MenuItem, NumberInput, Progress, Segmented, Toggle, cx } from '../components/ui'

/** Propose le numéro suivant : « 2.3 » → « 2.4 », « PSE 1 » → « PSE 2 » */
function nextRef(prev: string | undefined, kind: DpgfItem['kind'], items: DpgfItem[]): string {
  if (kind === 'chapter') {
    const n = items.filter((i) => i.kind === 'chapter').length + 1
    return String(n)
  }
  if (!prev) return ''
  const m = prev.match(/^(.*?)(\d+)$/)
  if (!m) return ''
  return m[1] + (Number(m[2]) + 1)
}

/** Renumérote : chapitres 1, 2, 3 ; lignes 1.1, 1.2 ; PSE 1, PSE 2 */
function renumber(items: DpgfItem[]): DpgfItem[] {
  let ch = 0
  let line = 0
  let pse = 0
  return items.map((it) => {
    if (it.kind === 'chapter') {
      if (/^pse/i.test(it.ref) || /prestations? suppl/i.test(it.label)) return it
      ch++
      line = 0
      return { ...it, ref: String(ch) }
    }
    if (it.scope === 'option') {
      pse++
      return { ...it, ref: `PSE ${pse}` }
    }
    line++
    return { ...it, ref: ch ? `${ch}.${line}` : String(line) }
  })
}

export default function DpgfTab() {
  const c = useC()
  const updateItem = useStore((s) => s.updateItem)
  const insertItems = useStore((s) => s.insertItems)
  const removeItem = useStore((s) => s.removeItem)
  const moveItem = useStore((s) => s.moveItem)
  const setItems = useStore((s) => s.setItems)
  const updateConsultation = useStore((s) => s.updateConsultation)
  const [pasting, setPasting] = useState(false)
  // Lignes extraites d'un fichier par l'IA, à relire dans le dialogue de collage
  const [aiText, setAiText] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const closePaste = () => (setPasting(false), setAiText(null))
  const aiDialog = (
    <AiImportDialog
      open={aiOpen}
      lotId={c.id}
      onClose={() => setAiOpen(false)}
      onRows={(text) => {
        setAiOpen(false)
        setAiText(text)
        setPasting(true)
      }}
    />
  )
  const [focusId, setFocusId] = useState<string | null>(null)
  const [addedId, setAddedId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const lineCount = useMemo(() => linesOf(c.items).length, [c.items])
  const pseCount = useMemo(() => c.items.filter((i) => i.kind === 'line' && i.scope === 'option').length, [c.items])
  const pricedIds = useMemo(() => new Set(c.offers.flatMap((o) => Object.keys(o.prices))), [c.offers])

  /** Budget estimé : somme qty × prix unitaire budget, lignes chiffrées uniquement. Jamais envoyé aux entreprises. */
  const budgetTotal = useMemo(() => {
    let total = 0
    let priced = 0
    for (const { item } of linesOf(c.items)) {
      const pu = c.budgetPrices[item.id]
      if (pu == null || item.qty == null) continue
      total += pu * item.qty
      priced++
    }
    return { total, priced }
  }, [c.items, c.budgetPrices])

  const setBudgetPrice = (itemId: string, v: number | null) => {
    const next = { ...c.budgetPrices }
    if (v == null) delete next[itemId]
    else next[itemId] = v
    updateConsultation(c.id, { budgetPrices: next })
  }

  useEffect(() => {
    if (!focusId) return
    const el = listRef.current?.querySelector<HTMLInputElement>(`[data-label="${focusId}"]`)
    el?.focus()
    setFocusId(null)
  }, [focusId, c.items])

  const add = (kind: DpgfItem['kind'], afterId?: string) => {
    const after = afterId ? c.items.find((i) => i.id === afterId) : c.items[c.items.length - 1]
    const lastLine = [...c.items.slice(0, after ? c.items.indexOf(after) + 1 : c.items.length)].reverse().find((i) => i.kind === 'line')
    const it = newItem({
      kind,
      unit: kind === 'chapter' ? '' : (lastLine?.unit ?? 'u'),
      scope: after?.kind === 'line' ? after.scope : 'base',
      ref: kind === 'chapter' ? nextRef(undefined, 'chapter', c.items) : after?.kind === 'chapter' ? (after.ref ? `${after.ref}.1` : '') : nextRef(lastLine?.ref, 'line', c.items),
    })
    insertItems(c.id, [it], after?.id ?? null)
    setFocusId(it.id)
    setAddedId(it.id)
  }

  const remove = (it: DpgfItem) => {
    if (pricedIds.has(it.id) && !confirm('Cette ligne contient des prix saisis dans les offres. La supprimer quand même ?')) return
    removeItem(c.id, it.id)
  }

  /** Entrée : passe à la ligne suivante, ou en crée une à la fin */
  const onEnter = (e: KeyboardEvent<HTMLInputElement>, idx: number, col: string) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const next = listRef.current?.querySelector<HTMLInputElement>(`[data-cell="${idx + 1}-${col}"]`)
    if (next) next.focus()
    else add('line')
  }

  if (c.items.length === 0) {
    return (
      <>
        <EmptyState
          title="Saisissez le DPGF"
          action={
            <>
              <Button variant="primary" icon={<ClipboardPaste size={17} />} onClick={() => setPasting(true)}>
                Coller depuis Excel
              </Button>
              <Button icon={<Sparkles size={17} />} onClick={() => setAiOpen(true)}>
                Importer un PDF ou un Excel <BetaBadge />
              </Button>
              <Button icon={<Heading size={17} />} onClick={() => add('chapter')}>
                Commencer par un chapitre
              </Button>
              <Button icon={<Plus size={17} />} onClick={() => add('line')}>
                Ajouter une ligne
              </Button>
            </>
          }
        >
          Copiez les colonnes N°, désignation, unité et quantité de votre DPGF Excel, puis collez-les : Batimatch reconnaît les
          colonnes et crée les chapitres. Ou déposez le fichier (PDF ou Excel) : l’IA en extrait les lignes, vous les relisez avant d’importer.
        </EmptyState>
        <PasteDpgfDialog open={pasting} onClose={closePaste} initialText={aiText} hasItems={false} onImport={(items) => setItems(c.id, items)} />
        {aiDialog}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.875rem] text-ink-2">
          <span className="num font-semibold text-ink">{lineCount}</span> ligne{lineCount > 1 ? 's' : ''}
          {pseCount > 0 && (
            <>
              , dont <span className="num font-semibold text-ink">{pseCount}</span> PSE
            </>
          )}
          . Les modifications sont enregistrées automatiquement.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<ClipboardPaste size={15} />} onClick={() => setPasting(true)}>
            Coller depuis Excel
          </Button>
          <Button size="sm" icon={<Sparkles size={15} />} onClick={() => setAiOpen(true)}>
            Importer un fichier <BetaBadge />
          </Button>
          <Button size="sm" icon={<ListOrdered size={15} />} onClick={() => setItems(c.id, renumber(c.items))}>
            Renuméroter
          </Button>
          <Button size="sm" icon={<FileSpreadsheet size={15} />} onClick={() => exportBlankDpgf(c)}>
            DPGF vierge (CSV)
          </Button>
        </div>
      </div>

      <div ref={listRef} className="panel overflow-hidden">
        <div className="hidden grid-cols-[4.5rem_minmax(0,1fr)_5.5rem_6.5rem_11rem_8rem_2.5rem] gap-2 border-b border-line bg-paper/70 px-3 py-2 text-[0.8125rem] text-ink-3 md:grid">
          <span className="pl-2">N°</span>
          <span className="pl-2">Désignation</span>
          <span className="pl-2">Unité</span>
          <span className="pr-2 text-right">Quantité</span>
          <span className="pr-2" title="Visible de vous seul">PU budget HT</span>
          <span className="pl-1">Type</span>
          <span />
        </div>
        <datalist id="units">
          {UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <ul>
          {c.items.map((it, idx) => (
            <li
              key={it.id}
              className={cx(
                'grid grid-cols-[3rem_minmax(0,1fr)_2rem] items-center gap-x-1.5 gap-y-0 border-b border-line-2 px-1.5 py-1 last:border-0 md:gap-x-2 md:grid-cols-[4.5rem_minmax(0,1fr)_5.5rem_6.5rem_11rem_8rem_2.5rem] md:px-3',
                it.kind === 'chapter' && 'bg-paper/80',
                it.id === addedId && 'anim-pop',
              )}
            >
              <input
                aria-label="Numéro"
                className={cx('field-bare num text-ink-2', it.kind === 'chapter' && 'font-semibold text-ink')}
                value={it.ref}
                onChange={(e) => updateItem(c.id, it.id, { ref: e.target.value })}
              />
              <input
                aria-label={it.kind === 'chapter' ? 'Titre du chapitre' : 'Désignation'}
                data-label={it.id}
                data-cell={`${idx}-label`}
                className={cx('field-bare min-w-0', it.kind === 'chapter' && 'font-title text-[1.0625rem] font-semibold', it.kind === 'chapter' && 'md:col-span-5')}
                placeholder={it.kind === 'chapter' ? 'Titre du chapitre' : 'Désignation de l’ouvrage'}
                value={it.label}
                onChange={(e) => updateItem(c.id, it.id, { label: e.target.value })}
                onKeyDown={(e) => onEnter(e, idx, 'label')}
              />
              {it.kind === 'line' && (
                <Descriptif
                  className="col-span-2 col-start-2 row-start-2 md:col-start-2 md:col-end-7 md:row-start-2"
                  label={`Descriptif, ${it.ref} ${it.label}`}
                  value={it.description ?? ''}
                  onChange={(description) => updateItem(c.id, it.id, { description })}
                />
              )}
              {it.kind === 'line' && (
                <div className="col-span-full row-start-3 flex items-center gap-1.5 md:contents">
                  <input
                    aria-label="Unité"
                    list="units"
                    className="field-bare w-14 min-w-0 text-ink-2 md:w-full md:text-ink"
                    value={it.unit}
                    onChange={(e) => updateItem(c.id, it.id, { unit: e.target.value })}
                  />
                  <NumberInput
                    bare
                    aria-label="Quantité"
                    data-cell={`${idx}-qty`}
                    className={cx('w-16 shrink-0 text-right md:w-full', it.qty == null && 'bg-warn-soft/60')}
                    placeholder="Qté"
                    value={it.qty}
                    onCommit={(v) => updateItem(c.id, it.id, { qty: v })}
                    onKeyDown={(e) => onEnter(e, idx, 'qty')}
                  />
                  <div className="flex min-w-0 shrink-0 items-center gap-1.5 md:w-full" title="Visible de vous seul, jamais par les entreprises">
                    <NumberInput
                      bare
                      aria-label="Prix unitaire budget"
                      data-cell={`${idx}-pu`}
                      className="w-[4.75rem] shrink-0 text-right text-budget md:w-24"
                      placeholder="PU budget"
                      value={c.budgetPrices[it.id] ?? null}
                      onCommit={(v) => setBudgetPrice(it.id, v)}
                      onKeyDown={(e) => onEnter(e, idx, 'pu')}
                    />
                    {c.budgetPrices[it.id] != null && it.qty != null && (
                      <span className="num hidden truncate text-[0.8125rem] text-ink-3 md:inline">= {fmtEur(c.budgetPrices[it.id] * it.qty)}</span>
                    )}
                  </div>
                  <div className="ml-auto shrink-0 md:ml-0">
                    <Segmented
                      size="sm"
                      label="Type de ligne"
                      value={it.scope}
                      onChange={(scope) => updateItem(c.id, it.id, { scope })}
                      options={[
                        { value: 'base', label: 'Base' },
                        { value: 'option', label: 'PSE' },
                      ]}
                    />
                  </div>
                </div>
              )}
              <div className="col-start-3 row-start-1 justify-self-end md:col-start-auto md:row-start-auto">
                <Menu label="Actions sur la ligne" icon={<MoreVertical size={17} />}>
                  {(close) => (
                    <>
                      <MenuItem icon={<Plus />} onClick={() => (close(), add('line', it.id))}>
                        Insérer une ligne dessous
                      </MenuItem>
                      <MenuItem icon={<Heading />} onClick={() => (close(), add('chapter', it.id))}>
                        Insérer un chapitre dessous
                      </MenuItem>
                      <MenuItem icon={<ArrowUp />} onClick={() => (close(), moveItem(c.id, it.id, -1))}>
                        Monter
                      </MenuItem>
                      <MenuItem icon={<ArrowDown />} onClick={() => (close(), moveItem(c.id, it.id, 1))}>
                        Descendre
                      </MenuItem>
                      <MenuItem
                        icon={<Repeat />}
                        onClick={() => {
                          close()
                          updateItem(c.id, it.id, it.kind === 'chapter' ? { kind: 'line', unit: 'u' } : { kind: 'chapter', unit: '', qty: null, scope: 'base' })
                        }}
                      >
                        {it.kind === 'chapter' ? 'Transformer en ligne' : 'Transformer en chapitre'}
                      </MenuItem>
                      <MenuItem icon={<Trash2 />} danger onClick={() => (close(), remove(it))}>
                        Supprimer
                      </MenuItem>
                    </>
                  )}
                </Menu>
              </div>
            </li>
          ))}
        </ul>
        <div className="no-print flex flex-wrap gap-2 border-t border-line bg-paper/50 px-3 py-2.5">
          <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={() => add('line')}>
            Ligne
          </Button>
          <Button size="sm" variant="ghost" icon={<Heading size={15} />} onClick={() => add('chapter')}>
            Chapitre
          </Button>
          <span className="ml-auto hidden self-center text-[0.7812rem] text-ink-3 sm:block">Entrée : ligne suivante</span>
        </div>
      </div>

      {budgetTotal.priced > 0 && (
        <div className="no-print flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-line bg-paper/50 px-4 py-3">
          <p className="text-[0.875rem] text-ink-2">
            Budget estimé HT <span className="text-ink-3">(visible de vous seul, {budgetTotal.priced} ligne{budgetTotal.priced > 1 ? 's' : ''} chiffrée{budgetTotal.priced > 1 ? 's' : ''})</span>
          </p>
          <span className="num text-[1.125rem] font-semibold text-budget">
            <AnimatedNumber value={budgetTotal.total} format={fmtEur} duration={450} />
          </span>
        </div>
      )}

      {lineCount > 0 && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-md border border-plan/25 bg-plan-soft/60 px-4 py-3">
          <p className="text-[0.9062rem]">
            {c.offers.length
              ? 'Le DPGF est à jour dans toutes les offres.'
              : 'DPGF prêt ? Envoyez-le aux entreprises, puis saisissez leurs prix.'}
          </p>
          <Link to="../offres" relative="path" className="inline-flex h-9 items-center rounded-[5px] bg-plan px-3.5 font-medium text-sheet hover:bg-plan-dark">
            {c.offers.length ? 'Voir les offres' : 'Saisir les offres'}
          </Link>
        </div>
      )}

      <PasteDpgfDialog
        open={pasting}
        onClose={closePaste}
        initialText={aiText}
        hasItems={c.items.length > 0}
        canReplace={c.offers.length === 0}
        onImport={(items, replace) => (replace ? setItems(c.id, items) : insertItems(c.id, items, null))}
      />
      {aiDialog}
    </div>
  )
}

const ROLE_LABEL: Record<ColumnRole, string> = { ref: 'N°', label: 'Désignation', desc: 'Descriptif', unit: 'Unité', qty: 'Quantité', ignore: 'Ignorer' }

function PasteDpgfDialog({
  open,
  onClose,
  onImport,
  hasItems,
  canReplace = true,
  initialText,
}: {
  /** Tableau déjà extrait (import par IA) : il remplit la zone de collage, à relire */
  initialText?: string | null
  open: boolean
  onClose: () => void
  onImport: (items: DpgfItem[], replace: boolean) => void
  hasItems: boolean
  canReplace?: boolean
}) {
  const [text, setText] = useState('')
  const fromAi = !!initialText
  useEffect(() => {
    if (open && initialText) setText(initialText)
  }, [open, initialText])
  const [roles, setRoles] = useState<ColumnRole[] | null>(null)
  const [chapters, setChapters] = useState(true)
  const [mode, setMode] = useState<'append' | 'replace'>('append')
  const rows = useMemo(() => splitClipboard(text), [text])
  const guessed = useMemo(() => guessDpgfColumns(rows), [rows])
  const activeRoles = roles && roles.length === guessed.length ? roles : guessed
  const items = useMemo(() => rowsToItems(rows, activeRoles, chapters), [rows, activeRoles, chapters])
  const width = activeRoles.length

  const close = () => {
    setText('')
    setRoles(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={fromAi ? 'Relire le DPGF extrait par l’IA' : 'Coller le DPGF depuis Excel'}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Annuler
          </Button>
          <Button
            variant="primary"
            disabled={!items.length}
            onClick={() => {
              onImport(items, mode === 'replace')
              close()
            }}
          >
            Importer {items.length || ''} ligne{items.length > 1 ? 's' : ''}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {fromAi ? (
          <p className="flex items-start gap-2 rounded-md bg-plan-soft/60 px-3 py-2 text-[0.875rem]">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-plan" />
            <span>
              Lignes extraites par l’IA <BetaBadge /> : une IA peut se tromper. Contrôlez les quantités et les unités dans l’aperçu avant d’importer ; vous pouvez corriger le texte ci-dessous.
            </span>
          </p>
        ) : (
          <p className="text-[0.875rem] text-ink-2">
            Dans Excel, sélectionnez les colonnes N°, désignation, unité et quantité (sans les prix), copiez, puis collez ici.
          </p>
        )}
        <textarea
          autoFocus={!fromAi}
          rows={text ? 4 : 7}
          className="field num resize-y text-[0.8438rem]"
          placeholder={'1\tTerrassements\n1.1\tDéblais en masse\tm3\t1850\n1.2\tRemblai GNT 0/31,5\tm3\t640'}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setRoles(null)
          }}
        />
        {rows.length > 0 && width > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Toggle checked={chapters} onChange={setChapters} label="Lignes sans unité ni quantité = chapitres" />
              {hasItems && canReplace && (
                <Segmented
                  size="sm"
                  label="Mode d'import"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'append', label: 'Ajouter à la fin' },
                    { value: 'replace', label: 'Remplacer le DPGF' },
                  ]}
                />
              )}
            </div>
            <div className="scroll-x rounded-md border border-line">
              <table className="w-full text-[0.8438rem]">
                <thead className="bg-paper">
                  <tr>
                    {activeRoles.map((r, i) => (
                      <th key={i} className="p-1.5 text-left font-normal">
                        <select
                          aria-label={`Colonne ${i + 1}`}
                          className="field py-1 text-[0.8125rem]"
                          value={r}
                          onChange={(e) => {
                            const next = [...activeRoles]
                            const role = e.target.value as ColumnRole
                            // Un rôle ne peut être porté que par une colonne
                            if (role !== 'ignore') next.forEach((x, k) => x === role && (next[k] = 'ignore'))
                            next[i] = role
                            setRoles(next)
                          }}
                        >
                          {(Object.keys(ROLE_LABEL) as ColumnRole[]).map((k) => (
                            <option key={k} value={k}>
                              {ROLE_LABEL[k]}
                            </option>
                          ))}
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((r, k) => (
                    <tr key={k} className="border-t border-line-2">
                      {Array.from({ length: width }, (_, i) => (
                        <td key={i} className={cx('max-w-[260px] truncate px-2.5 py-1', activeRoles[i] === 'ignore' && 'text-ink-3/70 line-through')}>
                          {r[i]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[0.8438rem] text-ink-2">
              <span className="num font-semibold text-ink">{items.filter((i) => i.kind === 'line').length}</span> lignes et{' '}
              <span className="num font-semibold text-ink">{items.filter((i) => i.kind === 'chapter').length}</span> chapitres
              détectés{rows.length > 8 ? ` (aperçu des 8 premières lignes sur ${rows.length})` : ''}.
            </p>
          </>
        )}
      </div>
    </Dialog>
  )
}

/** Pastille « Bêta » des fonctions encore en rodage */
function BetaBadge() {
  return <span className="ml-1 inline-block rounded-[3px] bg-marker px-1 py-px align-[1px] text-[0.625rem] leading-tight font-bold tracking-wide text-night uppercase">Bêta</span>
}

const AI_ACCEPT = '.pdf,.xlsx,.xls,.xlsm,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv'

/** Dépôt d'un DPGF PDF ou Excel : l'IA en extrait les lignes, relues ensuite dans le dialogue de collage */
function AiImportDialog({ open, lotId, onClose, onRows }: { open: boolean; lotId: string; onClose: () => void; onRows: (text: string) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!busy) return
    setSecs(0)
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [busy])
  useEffect(() => {
    if (!open) {
      setFile(null)
      setError(null)
      setBusy(false)
    }
  }, [open])

  const run = async (f: File) => {
    setFile(f)
    setError(null)
    if (f.size > 7 * 1024 * 1024) return setError(errorMessage(new Error('ai_too_big')))
    setBusy(true)
    try {
      const out = await api.importDpgfFile(lotId, f)
      onRows(out.rows.map((r) => r.join('\t')).join('\n'))
    } catch (e) {
      setError(errorMessage(e))
    }
    setBusy(false)
  }
  const STEPS = ['Envoi du fichier', 'Lecture du document par l’IA', 'Repérage des chapitres et des lignes', 'Contrôle des unités et des quantités']
  const step = Math.min(STEPS.length - 1, Math.floor(secs / 9))

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} title="Importer un DPGF par IA (bêta)">
      {busy ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
          <span className="relative grid size-12 place-items-center rounded-full bg-plan-soft text-plan">
            <Sparkles size={22} className="animate-pulse" />
          </span>
          <p className="font-semibold">{STEPS[step]}…</p>
          <p className="max-w-[34ch] text-[0.8438rem] text-ink-2">
            « {file?.name} » : comptez de 20 secondes à 2 minutes selon la longueur du document. Gardez cette fenêtre ouverte.
          </p>
          <Progress value={Math.min(0.95, secs / 90)} className="max-w-[16rem]" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label
            onDragOver={(e) => (e.preventDefault(), setOver(true))}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f) run(f)
            }}
            className={cx(
              'flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
              over ? 'border-plan bg-plan-soft/60' : 'border-line hover:border-plan/60 hover:bg-paper',
            )}
          >
            <FileUp size={26} className="text-plan" />
            <span className="font-semibold">Choisir un fichier</span>
            <span className="text-[0.8438rem] text-ink-2">PDF, Excel (.xlsx, .xls) ou CSV, 7 Mo maximum</span>
            <input
              type="file"
              accept={AI_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) run(f)
              }}
            />
          </label>
          {error && (
            <p className="rounded-md bg-bad-soft px-3 py-2 text-[0.875rem] text-bad" role="alert">
              {error}
            </p>
          )}
          <ul className="list-disc space-y-0.5 pl-5 text-[0.8125rem] leading-snug text-ink-2">
            <li>L’IA repère les chapitres, les désignations, les unités et les quantités ; les prix sont ignorés.</li>
            <li>Rien n’est importé d’office : vous relisez et corrigez le résultat avant de valider.</li>
            <li>Le fichier est envoyé à Anthropic (Claude) pour être lu ; il n’est pas conservé par Batimatch.</li>
            <li>Fonction en bêta : 15 imports par 24 heures.</li>
          </ul>
        </div>
      )}
    </Dialog>
  )
}
