import { memo, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ClipboardPaste, CopyPlus, Plus, Search, Trash2, Undo2 } from 'lucide-react'
import { useC } from './ConsultationLayout'
import { useStore } from '../store'
import { activeOffers, companyKey, linesOf, median, offerLabel, qtyOf } from '../lib/calc'
import { fmtEur, fmtEur2, fmtNum } from '../lib/format'
import { guessPriceColumn, parseNumber, parsePrice, splitClipboard } from '../lib/parse'
import type { DpgfItem, ExtraKind, Offer, PriceValue } from '../lib/types'
import { uid } from '../lib/id'
import { Button, DeviationChip, Dialog, EmptyState, Field, IconButton, NumberInput, Progress, Segmented, Toggle, cx, useAutoSelect } from '../components/ui'
import { ANOMALY_THRESHOLD } from '../lib/calc'

type Row = { kind: 'chapter'; item: DpgfItem; subtotal: number } | { kind: 'line'; item: DpgfItem; idx: number }

export default function OfferEditor() {
  const c = useC()
  const { oid } = useParams()
  const nav = useNavigate()
  const offer = c.offers.find((o) => o.id === oid)
  if (!offer) {
    return (
      <EmptyState title="Offre introuvable" action={<Button onClick={() => nav('..', { relative: 'path' })}>Retour aux offres</Button>}>
        Elle a peut-être été supprimée.
      </EmptyState>
    )
  }
  return <Editor key={offer.id} offer={offer} />
}

function Editor({ offer }: { offer: Offer }) {
  const c = useC()
  const nav = useNavigate()
  const updateOffer = useStore((s) => s.updateOffer)
  const setPrice = useStore((s) => s.setPrice)
  const setPrices = useStore((s) => s.setPrices)
  const removeOffer = useStore((s) => s.removeOffer)
  const newVersion = useStore((s) => s.newVersion)

  const [filter, setFilter] = useState<'all' | 'todo'>('all')
  const [todoSnapshot, setTodoSnapshot] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [undo, setUndo] = useState<{ text: string; prev: Record<string, PriceValue | null> } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  const lines = useMemo(() => linesOf(c.items), [c.items])
  const baseLines = lines.filter((l) => l.item.scope === 'base')

  // Médiane des autres entreprises, pour repérer les fautes de frappe en direct
  const medians = useMemo(() => {
    const others = activeOffers({ ...c, settings: { ...c.settings, latestOnly: true } }).filter(
      (o) => companyKey(o.company) !== companyKey(offer.company),
    )
    const m: Record<string, number | null> = {}
    for (const l of lines) {
      m[l.item.id] = median(others.map((o) => o.prices[l.item.id]).filter((p): p is number => typeof p === 'number'))
    }
    return { m, count: others.length }
  }, [c, lines, offer.company])

  const totals = useMemo(() => {
    let base = 0
    let pse = 0
    let filled = 0
    for (const l of lines) {
      const p = offer.prices[l.item.id]
      const amount = p === undefined ? 0 : p === 'inclus' ? 0 : p * qtyOf(l.item)
      if (l.item.scope === 'base') {
        base += amount
        if (p !== undefined) filled++
      } else pse += amount
    }
    const discount = base * ((offer.discountPct || 0) / 100)
    const extras = offer.extras.filter((e) => e.retained).reduce((a, e) => a + e.amount, 0)
    return { base, pse, discount, net: base - discount, extras, filled, total: baseLines.length }
  }, [lines, offer, baseLines.length])

  // Lignes affichées (filtre « à chiffrer » figé au moment du clic pour que les lignes ne disparaissent pas pendant la saisie)
  const rows: Row[] = useMemo(() => {
    const q = query
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
    const matches = (it: DpgfItem) =>
      !q ||
      `${it.ref} ${it.label}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .includes(q)
    const out: Row[] = []
    let chapter: Row | null = null
    let idx = 0
    for (const it of c.items) {
      if (it.kind === 'chapter') {
        chapter = { kind: 'chapter', item: it, subtotal: 0 }
        out.push(chapter)
        continue
      }
      const p = offer.prices[it.id]
      if (chapter && chapter.kind === 'chapter' && typeof p === 'number') chapter.subtotal += p * qtyOf(it)
      if (filter === 'todo' && !todoSnapshot.has(it.id)) continue
      if (!matches(it)) continue
      out.push({ kind: 'line', item: it, idx: idx++ })
    }
    // Retire les chapitres vides après filtrage
    return out.filter((r, i) => r.kind === 'line' || (out[i + 1] && out[i + 1].kind === 'line'))
  }, [c.items, offer.prices, filter, todoSnapshot, query])

  const visibleLines = useMemo(() => rows.filter((r): r is Extract<Row, { kind: 'line' }> => r.kind === 'line'), [rows])

  const focusIdx = (i: number) => {
    const el = tableRef.current?.querySelector<HTMLInputElement>(`[data-pidx="${i}"]`)
    if (!el) return false
    el.focus()
    el.scrollIntoView({ block: 'nearest' })
    return true
  }

  const applyMany = (startIdx: number, values: (PriceValue | null)[], label: string) => {
    const targets = visibleLines.slice(startIdx, startIdx + values.length)
    const prev: Record<string, PriceValue | null> = {}
    const next: Record<string, PriceValue | null> = {}
    targets.forEach((r, k) => {
      prev[r.item.id] = offer.prices[r.item.id] ?? null
      next[r.item.id] = values[k]
    })
    setPrices(c.id, offer.id, next)
    const n = Object.values(next).filter((v) => v != null).length
    setUndo({ text: `${n} prix collés à partir de la ligne ${targets[0]?.item.ref || targets[0]?.item.label || ''} ${label}`.trim(), prev })
  }

  const todoCount = baseLines.length - totals.filled + lines.filter((l) => l.item.scope === 'option' && offer.prices[l.item.id] === undefined).length
  const siblings = useMemo(() => [...c.offers].sort((a, b) => a.company.localeCompare(b.company) || a.version - b.version), [c.offers])

  return (
    <div className="flex flex-col gap-4">
      {/* Bascule rapide entre offres */}
      <div className="flex flex-wrap items-center gap-2">
        <Link to=".." relative="path" className="inline-flex items-center gap-1 text-[14px] text-ink-2 hover:text-ink">
          <ChevronLeft size={16} /> Toutes les offres
        </Link>
        {siblings.length > 1 && (
          <div className="scroll-x -mx-1 flex max-w-full gap-1 px-1 sm:ml-3">
            {siblings.map((o) => (
              <Link
                key={o.id}
                to={`../${o.id}`}
                relative="path"
                className={cx(
                  'rounded-full border px-2.5 py-0.5 text-[13px] whitespace-nowrap',
                  o.id === offer.id ? 'border-ink bg-ink text-white' : 'border-line bg-sheet text-ink-2 hover:border-ink-3',
                )}
              >
                {offerLabel(o, c.offers)}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* Grille de prix */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              aria-label="Entreprise"
              className="field-bare -ml-2 min-w-0 flex-1 font-title text-[28px] leading-tight font-bold"
              placeholder="Nom de l’entreprise"
              value={offer.company}
              onChange={(e) => updateOffer(c.id, offer.id, { company: e.target.value })}
            />
            <span className="num rounded-[4px] border border-ink px-2 py-0.5 text-[14px] font-semibold">V{offer.version}</span>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2">
            <Segmented
              label="Lignes affichées"
              size="sm"
              value={filter}
              onChange={(f) => {
                if (f === 'todo') setTodoSnapshot(new Set(lines.filter((l) => offer.prices[l.item.id] === undefined).map((l) => l.item.id)))
                setFilter(f)
              }}
              options={[
                { value: 'all', label: 'Toutes les lignes' },
                { value: 'todo', label: `À chiffrer (${todoCount})` },
              ]}
            />
            <label className="relative min-w-[160px] flex-1 sm:max-w-[260px]">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
              <input
                type="search"
                aria-label="Rechercher une ligne"
                className="field h-8 py-1 pl-8 text-[14px]"
                placeholder="Rechercher une ligne"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <Button size="sm" icon={<ClipboardPaste size={15} />} onClick={() => setPasteOpen(true)} className="sm:ml-auto">
              Coller une colonne de prix
            </Button>
          </div>

          {undo && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-good/30 bg-good-soft px-3 py-2 text-[14px]" role="status">
              <span>{undo.text}.</span>
              <span className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Undo2 size={15} />}
                  onClick={() => {
                    setPrices(c.id, offer.id, undo.prev)
                    setUndo(null)
                  }}
                >
                  Annuler
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setUndo(null)}>
                  OK
                </Button>
              </span>
            </div>
          )}

          <div ref={tableRef} className="panel overflow-hidden">
            <div className="hidden grid-cols-[4rem_minmax(0,1fr)_3.25rem_6rem_8.5rem_8rem_5.5rem] gap-2 border-b border-line bg-paper/70 px-3 py-2 text-[13px] text-ink-3 md:grid">
              <span>N°</span>
              <span>Désignation</span>
              <span>Unité</span>
              <span className="text-right">Quantité</span>
              <span className="pr-2 text-right">PU HT</span>
              <span className="text-right">Montant HT</span>
              <span className="text-right">{medians.count ? 'Écart' : ''}</span>
            </div>
            {rows.length === 0 && <p className="px-4 py-6 text-ink-2">Aucune ligne ne correspond.</p>}
            <ul>
              {rows.map((r) =>
                r.kind === 'chapter' ? (
                  <li key={r.item.id} className="flex items-baseline justify-between gap-3 border-b border-line-2 bg-paper/80 px-3 py-2">
                    <span className="font-title text-[17px] font-semibold">
                      <span className="num mr-2 text-ink-2">{r.item.ref}</span>
                      {r.item.label}
                    </span>
                    <span className="num text-[14px] text-ink-2">{r.subtotal ? fmtEur(r.subtotal) : ''}</span>
                  </li>
                ) : (
                  <PriceRow
                    key={r.item.id}
                    item={r.item}
                    idx={r.idx}
                    value={offer.prices[r.item.id]}
                    med={medians.m[r.item.id] ?? null}
                    onCommit={(v) => setPrice(c.id, offer.id, r.item.id, v)}
                    onNav={(d) => focusIdx(r.idx + d)}
                    onPasteMany={(vals) => applyMany(r.idx, vals, '')}
                  />
                ),
              )}
            </ul>
          </div>
          <p className="no-print text-[13px] text-ink-3">
            Entrée ou ↓ : ligne suivante. Tapez « i » pour une prestation incluse. Collez une colonne Excel dans une case pour remplir
            les lignes suivantes.
          </p>

          <ExtrasEditor offer={offer} />
        </div>

        {/* Récapitulatif et informations */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <section className="panel p-4" aria-label="Récapitulatif">
            <dl className="grid gap-2 text-[14.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Base déclarée</dt>
                <dd className="num font-medium">{fmtEur2(totals.base)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-2">Remise commerciale</dt>
                <dd className="w-24">
                  <NumberInput
                    aria-label="Remise commerciale en %"
                    className="h-8 py-1 text-right"
                    suffix="%"
                    value={offer.discountPct || null}
                    onCommit={(v) => updateOffer(c.id, offer.id, { discountPct: Math.min(100, v ?? 0) })}
                  />
                </dd>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between gap-3 text-ink-2">
                  <dt>Montant de la remise</dt>
                  <dd className="num">−{fmtEur2(totals.discount)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                <dt className="font-semibold">Base nette HT</dt>
                <dd className="num text-[22px] font-semibold">{fmtEur(totals.net)}</dd>
              </div>
              {totals.pse > 0 && (
                <div className="flex justify-between gap-3 text-ink-2">
                  <dt>PSE chiffrées</dt>
                  <dd className="num">{fmtEur(totals.pse)}</dd>
                </div>
              )}
              {offer.extras.length > 0 && (
                <div className="flex justify-between gap-3 text-ink-2">
                  <dt>Variantes et options retenues</dt>
                  <dd className="num">{fmtEur(totals.extras)}</dd>
                </div>
              )}
            </dl>
            <div className="mt-3 grid gap-1.5">
              <div className="flex justify-between text-[13px] text-ink-2">
                <span>Lignes de base renseignées</span>
                <span className="num">
                  {totals.filled}/{totals.total}
                </span>
              </div>
              <Progress value={totals.total ? totals.filled / totals.total : 0} />
            </div>
          </section>

          <section className="panel grid gap-3 p-4" aria-label="Informations de l'offre">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reçue le" htmlFor="o-recv">
                <input
                  id="o-recv"
                  type="date"
                  className="field h-9 py-1"
                  value={offer.receivedAt ?? ''}
                  onChange={(e) => updateOffer(c.id, offer.id, { receivedAt: e.target.value || null })}
                />
              </Field>
              <Field label="Valable jusqu’au" htmlFor="o-valid">
                <input
                  id="o-valid"
                  type="date"
                  className="field h-9 py-1"
                  value={offer.validUntil ?? ''}
                  onChange={(e) => updateOffer(c.id, offer.id, { validUntil: e.target.value || null })}
                />
              </Field>
              <Field label="Délai d’exécution" htmlFor="o-delay">
                <NumberInput
                  id="o-delay"
                  className="h-9 py-1"
                  suffix="sem."
                  value={offer.durationWeeks}
                  onCommit={(v) => updateOffer(c.id, offer.id, { durationWeeks: v })}
                />
              </Field>
              <Field label="Note technique" htmlFor="o-tech">
                <NumberInput
                  id="o-tech"
                  className="h-9 py-1"
                  suffix="/20"
                  value={offer.techScore}
                  onCommit={(v) => updateOffer(c.id, offer.id, { techScore: v == null ? null : Math.min(20, v) })}
                />
              </Field>
            </div>
            <Field label="Réserves et exclusions" htmlFor="o-res" hint="Reprises dans les points de vigilance du comparatif.">
              <textarea
                id="o-res"
                rows={3}
                className="field resize-y text-[14px]"
                placeholder="Ex. bassin de rétention exclu, terres ISDI+ en plus-value…"
                value={offer.reserves}
                onChange={(e) => updateOffer(c.id, offer.id, { reserves: e.target.value })}
              />
            </Field>
            <Field label="Notes internes" htmlFor="o-notes">
              <textarea
                id="o-notes"
                rows={2}
                className="field resize-y text-[14px]"
                value={offer.notes}
                onChange={(e) => updateOffer(c.id, offer.id, { notes: e.target.value })}
              />
            </Field>
          </section>

          <div className="no-print flex flex-wrap gap-2">
            <Button
              size="sm"
              icon={<CopyPlus size={15} />}
              onClick={() => {
                const id = newVersion(c.id, offer.id)
                if (id) nav(`../${id}`, { relative: 'path' })
              }}
            >
              Créer la version {offer.version + 1}
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 size={15} />}
              onClick={() => {
                if (confirm(`Supprimer l’offre ${offer.company} V${offer.version} ?`)) {
                  removeOffer(c.id, offer.id)
                  nav('..', { relative: 'path' })
                }
              }}
            >
              Supprimer
            </Button>
          </div>
        </aside>
      </div>

      {/* Barre de total collante sur mobile */}
      <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-sheet/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4">
          <div>
            <p className="text-[12px] text-ink-3">Base nette HT</p>
            <p className="num text-[20px] leading-tight font-semibold">{fmtEur(totals.net)}</p>
          </div>
          <div className="w-32">
            <p className="num mb-1 text-right text-[12px] text-ink-3">
              {totals.filled}/{totals.total} lignes
            </p>
            <Progress value={totals.total ? totals.filled / totals.total : 0} />
          </div>
        </div>
      </div>

      <PastePricesDialog
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        lines={visibleLines.map((r) => r.item)}
        prices={offer.prices}
        onApply={(start, values) => applyMany(start, values, '')}
      />
    </div>
  )
}

// ————————————————————————— Ligne de prix —————————————————————————

const PriceRow = memo(function PriceRow({
  item,
  idx,
  value,
  med,
  onCommit,
  onNav,
  onPasteMany,
}: {
  item: DpgfItem
  idx: number
  value: PriceValue | undefined
  med: number | null
  onCommit: (v: PriceValue | null) => void
  onNav: (delta: number) => boolean
  onPasteMany: (values: (PriceValue | null)[]) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const sel = useAutoSelect()
  const amount = value === undefined ? null : value === 'inclus' ? 0 : value * qtyOf(item)
  const deviation = typeof value === 'number' && med != null && med > 0 ? (value - med) / med : null
  const strong = deviation != null && Math.abs(deviation) > ANOMALY_THRESHOLD
  const display = draft ?? (value === undefined ? '' : value === 'inclus' ? 'inclus' : fmtNum(value))

  const commit = () => {
    if (draft == null) return
    const v = parsePrice(draft)
    setDraft(null)
    if (v !== (value ?? null)) onCommit(v)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      // Dernière ligne : on valide quand même la saisie
      if (!onNav(e.shiftKey && e.key === 'Enter' ? -1 : 1)) (e.target as HTMLInputElement).blur()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      onNav(-1)
    } else if (e.key === 'Escape') {
      setDraft(null)
      ;(e.target as HTMLInputElement).blur()
    }
  }
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (!/[\n\t]/.test(text.trim())) return
    e.preventDefault()
    const rows = splitClipboard(text)
    const col = rows[0]?.length > 1 ? guessPriceColumn(rows, []) : 0
    setDraft(null)
    onPasteMany(rows.map((r) => parsePrice(r[col] ?? '')))
  }

  return (
    <li
      className={cx(
        'grid grid-cols-[minmax(0,1fr)_8.25rem] items-center gap-x-3 border-b border-line-2 px-3 py-2 last:border-0 md:grid-cols-[4rem_minmax(0,1fr)_3.25rem_6rem_8.5rem_8rem_5.5rem] md:gap-x-2 md:py-1',
        value === undefined && 'bg-[linear-gradient(90deg,var(--color-warn-soft)_0_3px,transparent_3px)]',
      )}
    >
      <span className="num hidden text-[14px] text-ink-2 md:block">{item.ref}</span>
      <div className="min-w-0">
        <p className="text-[14.5px] leading-snug">
          <span className="num mr-1.5 text-ink-3 md:hidden">{item.ref}</span>
          {item.label || <span className="text-ink-3">Sans désignation</span>}
          {item.scope === 'option' && <span className="ml-2 rounded-[3px] bg-plan-soft px-1 text-[11.5px] font-semibold text-plan-dark">PSE</span>}
        </p>
        <p className="num mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-3 md:hidden">
          <span>
            {fmtNum(item.qty)} {item.unit}
          </span>
          {amount != null && amount > 0 && <span>= {fmtEur(amount)}</span>}
          <DeviationChip value={deviation} strong={strong} />
        </p>
      </div>
      <span className="hidden text-[14px] text-ink-2 md:block">{item.unit}</span>
      <span className={cx('num hidden text-right text-[14px] md:block', item.qty == null && 'text-warn')}>{item.qty == null ? 'à définir' : fmtNum(item.qty)}</span>
      <input
        type="text"
        inputMode="decimal"
        enterKeyHint="next"
        autoComplete="off"
        data-pidx={idx}
        aria-label={`Prix unitaire, ${item.ref} ${item.label}`}
        title={med != null ? `Médiane des autres offres : ${fmtNum(med)} €` : undefined}
        className={cx(
          'field num h-10 py-1 text-right text-[16px] md:h-9 md:text-[15px]',
          value === 'inclus' && 'text-good italic',
          strong && 'border-bad/50',
        )}
        placeholder="PU"
        value={display}
        ref={sel.ref}
        onFocus={() => {
          setDraft(value === undefined ? '' : value === 'inclus' ? 'inclus' : String(value).replace('.', ','))
          sel.request()
        }}
        onMouseUp={sel.onMouseUp}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        onPaste={onPaste}
      />
      <span className="num hidden text-right text-[14.5px] md:block">{amount == null ? '' : value === 'inclus' ? 'inclus' : fmtEur2(amount)}</span>
      <span className="hidden text-right md:block">
        <DeviationChip value={deviation} strong={strong} />
      </span>
    </li>
  )
})

// ————————————————————————— Variantes et options —————————————————————————

function ExtrasEditor({ offer }: { offer: Offer }) {
  const c = useC()
  const addExtra = useStore((s) => s.addExtra)
  const updateExtra = useStore((s) => s.updateExtra)
  const removeExtra = useStore((s) => s.removeExtra)
  const [kind, setKind] = useState<ExtraKind>('variante')
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')

  const submit = () => {
    const v = parseNumber(amount)
    if (!label.trim() || v == null) return
    addExtra(c.id, offer.id, { id: uid(), kind, label: label.trim(), amount: v, retained: false })
    setLabel('')
    setAmount('')
  }

  return (
    <section className="panel" aria-labelledby="extras-title">
      <header className="border-b border-line-2 px-4 py-3">
        <h3 id="extras-title" className="font-title text-[20px] font-semibold">
          Variantes et options proposées
        </h3>
        <p className="text-[13.5px] text-ink-2">
          Variante : écart par rapport à la base, négatif si c’est une économie. Option : plus-value hors DPGF.
        </p>
      </header>
      {offer.extras.length > 0 && (
        <ul>
          {offer.extras.map((e) => (
            <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-line-2 px-4 py-2.5 sm:grid-cols-[6.5rem_minmax(0,1fr)_8rem_auto_auto]">
              <span
                className={cx(
                  'w-fit rounded-[3px] px-1.5 py-0.5 text-[12px] font-semibold',
                  e.kind === 'variante' ? 'bg-plan-soft text-plan-dark' : 'bg-warn-soft text-warn',
                )}
              >
                {e.kind === 'variante' ? 'Variante' : 'Option'}
              </span>
              <input
                aria-label="Libellé"
                className="field-bare col-span-2 col-start-1 row-start-2 -ml-2 min-w-0 sm:col-span-1 sm:col-start-auto sm:row-start-auto sm:ml-0"
                value={e.label}
                onChange={(ev) => updateExtra(c.id, offer.id, e.id, { label: ev.target.value })}
              />
              <div className="col-start-1 row-start-3 sm:col-start-auto sm:row-start-auto">
              <NumberInput
                bare
                allowNegative
                aria-label="Montant HT"
                className={cx('-ml-2 w-36 sm:ml-0 sm:w-full sm:text-right', e.amount < 0 && 'text-good')}
                value={e.amount}
                format={(v) => (v == null ? '' : `${v > 0 ? '+' : ''}${fmtEur(v)}`)}
                onCommit={(v) => updateExtra(c.id, offer.id, e.id, { amount: v ?? 0 })}
              />
              </div>
              <span className="col-start-2 row-start-3 justify-self-end sm:col-start-auto sm:row-start-auto">
                <Toggle checked={e.retained} onChange={(v) => updateExtra(c.id, offer.id, e.id, { retained: v })} label="Au comparatif" />
              </span>
              <IconButton label="Supprimer" className="col-start-2 row-start-1 justify-self-end sm:col-start-auto sm:row-start-auto" onClick={() => removeExtra(c.id, offer.id, e.id)}>
                <Trash2 size={16} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-end gap-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_8rem_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="col-span-2 sm:col-span-1">
          <Segmented
            size="sm"
            label="Type"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'variante', label: 'Variante' },
              { value: 'option', label: 'Option' },
            ]}
          />
        </div>
        <input aria-label="Libellé de la variante ou de l'option" className="field h-9 py-1 text-[14px]" placeholder="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input
          aria-label="Montant HT"
          inputMode="decimal"
          className="field num h-9 py-1 text-right text-[14px]"
          placeholder={kind === 'variante' ? '−5 000' : '+3 000'}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button type="submit" size="sm" icon={<Plus size={15} />} disabled={!label.trim() || parseNumber(amount) == null} className="col-span-2 h-9 sm:col-span-1">
          Ajouter
        </Button>
      </form>
    </section>
  )
}

// ————————————————————————— Collage d'une colonne de prix —————————————————————————

function PastePricesDialog({
  open,
  onClose,
  lines,
  prices,
  onApply,
}: {
  open: boolean
  onClose: () => void
  lines: DpgfItem[]
  prices: Record<string, PriceValue>
  onApply: (startIdx: number, values: (PriceValue | null)[]) => void
}) {
  const [text, setText] = useState('')
  const [col, setCol] = useState<number | null>(null)
  const [start, setStart] = useState(0)
  const rows = useMemo(() => splitClipboard(text), [text])
  const width = Math.max(0, ...rows.map((r) => r.length))
  const guessed = useMemo(
    () => guessPriceColumn(rows, lines.slice(start, start + rows.length).map((l) => l.qty)),
    [rows, lines, start],
  )
  const column = col != null && col < width ? col : guessed
  const values = rows.map((r) => parsePrice(r[column] ?? ''))
  const filled = values.filter((v) => v != null).length
  const overwrite = lines.slice(start, start + values.length).filter((l, k) => values[k] != null && prices[l.id] !== undefined).length

  const close = () => {
    setText('')
    setCol(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      wide
      title="Coller une colonne de prix"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Annuler
          </Button>
          <Button
            variant="primary"
            disabled={!filled}
            onClick={() => {
              onApply(start, values)
              close()
            }}
          >
            Appliquer {filled || ''} prix
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-[14px] text-ink-2">
          Copiez la colonne des prix unitaires de l’offre (ou des lignes entières), dans le même ordre que le DPGF. Les cellules vides
          restent non chiffrées.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
          <Field label="À partir de la ligne" htmlFor="pp-start">
            <select id="pp-start" className="field" value={start} onChange={(e) => setStart(Number(e.target.value))}>
              {lines.map((l, i) => (
                <option key={l.id} value={i}>
                  {[l.ref, l.label].filter(Boolean).join(' ').slice(0, 70)}
                </option>
              ))}
            </select>
          </Field>
          {width > 1 && (
            <Field label="Colonne des PU" htmlFor="pp-col">
              <select id="pp-col" className="field" value={column} onChange={(e) => setCol(Number(e.target.value))}>
                {Array.from({ length: width }, (_, i) => (
                  <option key={i} value={i}>
                    Colonne {i + 1} : {rows.slice(0, 3).map((r) => r[i] || '…').join(', ').slice(0, 40)}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <textarea
          autoFocus
          rows={text ? 4 : 7}
          className="field num resize-y text-[13.5px]"
          placeholder={'18 000\n3 500\n12,40\ninclus'}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setCol(null)
          }}
        />
        {rows.length > 0 && (
          <>
            <div className="scroll-x max-h-64 rounded-md border border-line">
              <table className="w-full text-[13.5px]">
                <tbody>
                  {values.slice(0, 40).map((v, k) => {
                    const l = lines[start + k]
                    return (
                      <tr key={k} className="border-b border-line-2 last:border-0">
                        <td className="num w-16 px-2.5 py-1 text-ink-3">{l?.ref}</td>
                        <td className="max-w-[320px] truncate px-2.5 py-1">{l ? l.label : <span className="text-bad">Au-delà du DPGF : ignoré</span>}</td>
                        <td className={cx('num px-2.5 py-1 text-right', v == null && 'text-ink-3')}>
                          {v == null ? 'vide' : v === 'inclus' ? 'inclus' : fmtNum(v)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[13.5px] text-ink-2">
              {filled} prix lus sur {rows.length} lignes.
              {overwrite > 0 && <span className="text-warn"> {overwrite} prix déjà saisis seront remplacés.</span>}
              {start + rows.length > lines.length && <span className="text-bad"> Le collage dépasse la fin du DPGF.</span>}
            </p>
          </>
        )}
      </div>
    </Dialog>
  )
}
