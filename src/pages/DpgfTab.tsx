import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import {
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
import { useC } from './ConsultationLayout'
import { newItem, useStore } from '../store'
import { linesOf } from '../lib/calc'
import { UNITS, guessDpgfColumns, rowsToItems, splitClipboard, type ColumnRole } from '../lib/parse'
import { exportBlankDpgf } from '../lib/io'
import type { DpgfItem } from '../lib/types'
import { Button, Dialog, EmptyState, Menu, MenuItem, NumberInput, Segmented, Toggle, cx } from '../components/ui'

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
  const [pasting, setPasting] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const lineCount = useMemo(() => linesOf(c.items).length, [c.items])
  const pseCount = useMemo(() => c.items.filter((i) => i.kind === 'line' && i.scope === 'option').length, [c.items])
  const pricedIds = useMemo(() => new Set(c.offers.flatMap((o) => Object.keys(o.prices))), [c.offers])

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
          colonnes et crée les chapitres.
        </EmptyState>
        <PasteDpgfDialog open={pasting} onClose={() => setPasting(false)} hasItems={false} onImport={(items) => setItems(c.id, items)} />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-ink-2">
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
          <Button size="sm" icon={<ListOrdered size={15} />} onClick={() => setItems(c.id, renumber(c.items))}>
            Renuméroter
          </Button>
          <Button size="sm" icon={<FileSpreadsheet size={15} />} onClick={() => exportBlankDpgf(c)}>
            DPGF vierge (CSV)
          </Button>
        </div>
      </div>

      <div ref={listRef} className="panel overflow-hidden">
        <div className="hidden grid-cols-[5rem_minmax(0,1fr)_6.5rem_7.5rem_8.5rem_2.5rem] gap-2 border-b border-line bg-paper/70 px-3 py-2 text-[13px] text-ink-3 md:grid">
          <span className="pl-2">N°</span>
          <span className="pl-2">Désignation</span>
          <span className="pl-2">Unité</span>
          <span className="pr-2 text-right">Quantité</span>
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
                'grid grid-cols-[3.75rem_minmax(0,1fr)_2.25rem] items-center gap-x-2 gap-y-1 border-b border-line-2 px-2 py-1.5 last:border-0 md:grid-cols-[5rem_minmax(0,1fr)_6.5rem_7.5rem_8.5rem_2.5rem] md:px-3',
                it.kind === 'chapter' && 'bg-paper/80 py-2',
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
                className={cx('field-bare min-w-0', it.kind === 'chapter' && 'font-title text-[18px] font-semibold', it.kind === 'chapter' && 'md:col-span-4')}
                placeholder={it.kind === 'chapter' ? 'Titre du chapitre' : 'Désignation de l’ouvrage'}
                value={it.label}
                onChange={(e) => updateItem(c.id, it.id, { label: e.target.value })}
                onKeyDown={(e) => onEnter(e, idx, 'label')}
              />
              {it.kind === 'line' && (
                <div className="col-start-2 row-start-2 flex items-center gap-2 md:contents">
                  <input
                    aria-label="Unité"
                    list="units"
                    className="field-bare w-[4.5rem] md:w-full"
                    value={it.unit}
                    onChange={(e) => updateItem(c.id, it.id, { unit: e.target.value })}
                  />
                  <NumberInput
                    bare
                    aria-label="Quantité"
                    data-cell={`${idx}-qty`}
                    className={cx('w-[6.5rem] text-right md:w-full', it.qty == null && 'bg-warn-soft/60')}
                    placeholder="Qté"
                    value={it.qty}
                    onCommit={(v) => updateItem(c.id, it.id, { qty: v })}
                    onKeyDown={(e) => onEnter(e, idx, 'qty')}
                  />
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
          <span className="ml-auto hidden self-center text-[12.5px] text-ink-3 sm:block">Entrée : ligne suivante</span>
        </div>
      </div>

      {lineCount > 0 && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-md border border-plan/25 bg-plan-soft/60 px-4 py-3">
          <p className="text-[14.5px]">
            {c.offers.length
              ? 'Le DPGF est à jour dans toutes les offres.'
              : 'DPGF prêt ? Envoyez-le aux entreprises, puis saisissez leurs prix.'}
          </p>
          <Link to="../offres" relative="path" className="inline-flex h-9 items-center rounded-[5px] bg-plan px-3.5 font-medium text-white hover:bg-plan-dark">
            {c.offers.length ? 'Voir les offres' : 'Saisir les offres'}
          </Link>
        </div>
      )}

      <PasteDpgfDialog
        open={pasting}
        onClose={() => setPasting(false)}
        hasItems={c.items.length > 0}
        canReplace={c.offers.length === 0}
        onImport={(items, replace) => (replace ? setItems(c.id, items) : insertItems(c.id, items, null))}
      />
    </div>
  )
}

const ROLE_LABEL: Record<ColumnRole, string> = { ref: 'N°', label: 'Désignation', unit: 'Unité', qty: 'Quantité', ignore: 'Ignorer' }

function PasteDpgfDialog({
  open,
  onClose,
  onImport,
  hasItems,
  canReplace = true,
}: {
  open: boolean
  onClose: () => void
  onImport: (items: DpgfItem[], replace: boolean) => void
  hasItems: boolean
  canReplace?: boolean
}) {
  const [text, setText] = useState('')
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
      title="Coller le DPGF depuis Excel"
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
        <p className="text-[14px] text-ink-2">
          Dans Excel, sélectionnez les colonnes N°, désignation, unité et quantité (sans les prix), copiez, puis collez ici.
        </p>
        <textarea
          autoFocus
          rows={text ? 4 : 7}
          className="field num resize-y text-[13.5px]"
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
              <table className="w-full text-[13.5px]">
                <thead className="bg-paper">
                  <tr>
                    {activeRoles.map((r, i) => (
                      <th key={i} className="p-1.5 text-left font-normal">
                        <select
                          aria-label={`Colonne ${i + 1}`}
                          className="field py-1 text-[13px]"
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
            <p className="text-[13.5px] text-ink-2">
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
