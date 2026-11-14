import type { Consultation, DpgfItem, Offer, PriceValue } from './types'

// ————————————————————————————————————————————————————————————
// Outils statistiques
// ————————————————————————————————————————————————————————————

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null)
export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
export function stdev(xs: number[]): number | null {
  const m = mean(xs)
  if (m == null || xs.length < 2) return null
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1))
}

/** Seuil d'écart à la médiane au-delà duquel un prix est signalé */
export const ANOMALY_THRESHOLD = 0.3

// ————————————————————————————————————————————————————————————
// Structure du DPGF
// ————————————————————————————————————————————————————————————

export interface LineRef {
  item: DpgfItem
  chapterId: string | null
  chapterLabel: string
}

/** Lignes chiffrables avec leur chapitre de rattachement */
export function linesOf(items: DpgfItem[]): LineRef[] {
  let chapterId: string | null = null
  let chapterLabel = 'Sans chapitre'
  const out: LineRef[] = []
  for (const it of items) {
    if (it.kind === 'chapter') {
      chapterId = it.id
      chapterLabel = [it.ref, it.label].filter(Boolean).join(' ')
    } else {
      out.push({ item: it, chapterId, chapterLabel })
    }
  }
  return out
}

export const qtyOf = (it: DpgfItem) => it.qty ?? 0

/** Montant d'une ligne pour une offre : null si non chiffrée, 0 si « inclus » */
export function lineAmount(price: PriceValue | undefined, it: DpgfItem): number | null {
  if (price === undefined) return null
  if (price === 'inclus') return 0
  return price * qtyOf(it)
}

/** Montant de base déclaré par l'offre (avant remise, lignes non chiffrées exclues) */
export function declaredBase(offer: Offer, items: DpgfItem[]): number {
  return sum(
    linesOf(items)
      .filter((l) => l.item.scope === 'base')
      .map((l) => lineAmount(offer.prices[l.item.id], l.item) ?? 0),
  )
}

/** Nombre de lignes de base renseignées (prix ou « inclus ») */
export function filledCount(offer: Offer, items: DpgfItem[]) {
  const base = linesOf(items).filter((l) => l.item.scope === 'base')
  const filled = base.filter((l) => offer.prices[l.item.id] !== undefined).length
  return { filled, total: base.length }
}

/** Offres retenues pour la comparaison (dernière version par entreprise si demandé) */
export function activeOffers(c: Consultation): Offer[] {
  if (!c.settings.latestOnly) return c.offers
  const byCompany = new Map<string, Offer>()
  for (const o of c.offers) {
    const k = companyKey(o.company)
    const cur = byCompany.get(k)
    if (!cur || o.version > cur.version || (o.version === cur.version && (o.receivedAt ?? '') > (cur.receivedAt ?? ''))) {
      byCompany.set(k, o)
    }
  }
  // On conserve l'ordre de saisie
  return c.offers.filter((o) => byCompany.get(companyKey(o.company)) === o)
}

export const companyKey = (name: string) => name.trim().toLowerCase()

/** Libellé d'une offre : « Entreprise » ou « Entreprise V2 » si plusieurs versions */
export function offerLabel(o: Offer, all: Offer[]): string {
  const multi = all.filter((x) => companyKey(x.company) === companyKey(o.company)).length > 1
  return multi ? `${o.company || 'Sans nom'} V${o.version}` : o.company || 'Sans nom'
}

// ————————————————————————————————————————————————————————————
// Analyse comparative
// ————————————————————————————————————————————————————————————

export type CellFlag = 'ok' | 'missing' | 'included' | 'high' | 'low'

export interface LineCell {
  offerId: string
  price: PriceValue | undefined
  amount: number | null
  /** Écart du PU à la médiane des autres prix (0,25 = +25 %) */
  deviation: number | null
  flag: CellFlag
  isMin: boolean
  /** Montant ajouté par la remise à niveau si la ligne est non chiffrée */
  filled: number
}

export interface LineStat {
  item: DpgfItem
  chapterId: string | null
  chapterLabel: string
  min: number | null
  max: number | null
  median: number | null
  /** Montant médian de la ligne (médiane PU × quantité) */
  medianAmount: number
  cells: LineCell[]
}

export interface ChapterStat {
  id: string | null
  label: string
  totals: Record<string, number>
  median: number | null
}

export interface OfferResult {
  offer: Offer
  label: string
  /** Base déclarée avant remise */
  declared: number
  discount: number
  /** Complément de remise à niveau des lignes non chiffrées */
  fill: number
  /** Base comparable = déclarée − remise + remise à niveau */
  baseComparable: number
  pse: number
  extras: number
  /** Total du scénario retenu (base comparable + PSE retenues + variantes/options retenues) */
  total: number
  missingCount: number
  includedCount: number
  completeness: number
  /** Surcoût des lignes plus chères que la médiane : levier de négociation */
  overMedian: number
  rank: number
  vsBest: number | null
  vsAverage: number | null
  vsBudget: number | null
  vsBudgetAmount: number | null
  priceScore: number | null
  techScore: number | null
  globalScore: number | null
  scoreRank: number | null
  chapterTotals: Record<string, number>
  anomalies: number
}

export interface VersionPoint {
  offerId: string
  version: number
  receivedAt: string | null
  total: number
}

export interface CompanyHistory {
  company: string
  points: VersionPoint[]
  /** Gain obtenu entre la première et la dernière version */
  gain: number
  gainPct: number | null
}

export interface ParetoRow {
  item: DpgfItem
  amount: number
  share: number
  cumulative: number
}

export interface Insight {
  level: 'info' | 'warning' | 'critical' | 'good'
  text: string
}

export interface Analysis {
  offers: OfferResult[]
  ranked: OfferResult[]
  lines: LineStat[]
  chapters: ChapterStat[]
  best: OfferResult | null
  second: OfferResult | null
  gapBestSecond: number | null
  average: number | null
  medianTotal: number | null
  spread: number | null
  cv: number | null
  budget: number | null
  bestVsBudget: number | null
  /** Somme des meilleurs prix ligne à ligne (lignes de base) */
  theoreticalBest: number | null
  /** Écart entre le moins-disant et l'optimum théorique */
  negotiationPotential: number | null
  pareto: ParetoRow[]
  paretoCount80: number
  histories: CompanyHistory[]
  insights: Insight[]
  baseLineCount: number
  pseLines: DpgfItem[]
}

export function analyze(c: Consultation): Analysis {
  const offers = activeOffers(c)
  const lines = linesOf(c.items)
  const { fillMode, pseRetained, priceWeight } = c.settings

  // — Statistiques ligne à ligne —
  const lineStats: LineStat[] = lines.map(({ item, chapterId, chapterLabel }) => {
    const numeric = offers
      .map((o) => o.prices[item.id])
      .filter((p): p is number => typeof p === 'number')
    const med = median(numeric)
    const min = numeric.length ? Math.min(...numeric) : null
    const max = numeric.length ? Math.max(...numeric) : null
    const cells: LineCell[] = offers.map((o) => {
      const price = o.prices[item.id]
      const amount = lineAmount(price, item)
      let deviation: number | null = null
      let flag: CellFlag = 'ok'
      if (price === undefined) flag = 'missing'
      else if (price === 'inclus') flag = 'included'
      else {
        // Écart à la médiane des AUTRES offres pour ne pas s'auto-référencer
        const others = offers
          .filter((x) => x.id !== o.id)
          .map((x) => x.prices[item.id])
          .filter((p): p is number => typeof p === 'number')
        const ref = median(others)
        if (ref != null && ref > 0) {
          deviation = (price - ref) / ref
          if (deviation > ANOMALY_THRESHOLD) flag = 'high'
          else if (deviation < -ANOMALY_THRESHOLD) flag = 'low'
        }
      }
      let filled = 0
      if (price === undefined && fillMode !== 'none') {
        const ref = fillMode === 'max' ? max : med
        filled = (ref ?? 0) * qtyOf(item)
      }
      return { offerId: o.id, price, amount, deviation, flag, isMin: false, filled }
    })
    if (min != null && numeric.length >= 2) {
      cells.forEach((cell) => {
        if (typeof cell.price === 'number' && cell.price === min) cell.isMin = true
      })
    }
    return { item, chapterId, chapterLabel, min, max, median: med, medianAmount: (med ?? 0) * qtyOf(item), cells }
  })

  const baseStats = lineStats.filter((l) => l.item.scope === 'base')
  const pseStats = lineStats.filter((l) => l.item.scope === 'option')
  const retainedPse = pseStats.filter((l) => pseRetained[l.item.id])

  // — Résultats par offre —
  const results: OfferResult[] = offers.map((o, idx) => {
    let declared = 0
    let fill = 0
    let missingCount = 0
    let includedCount = 0
    let overMedian = 0
    let anomalies = 0
    const chapterTotals: Record<string, number> = {}
    for (const l of baseStats) {
      const cell = l.cells[idx]
      if (cell.flag === 'missing') missingCount++
      if (cell.flag === 'included') includedCount++
      if (cell.flag === 'high' || cell.flag === 'low') anomalies++
      declared += cell.amount ?? 0
      fill += cell.filled
      if (typeof cell.price === 'number' && l.median != null && cell.price > l.median) {
        overMedian += (cell.price - l.median) * qtyOf(l.item)
      }
      const key = l.chapterId ?? '_'
      chapterTotals[key] = (chapterTotals[key] ?? 0) + (cell.amount ?? 0) + cell.filled
    }
    const discount = declared * ((o.discountPct || 0) / 100)
    const baseComparable = declared - discount + fill
    const pse = sum(retainedPse.map((l) => (l.cells[idx].amount ?? 0) + l.cells[idx].filled))
    const extras = sum(o.extras.filter((e) => e.retained).map((e) => e.amount))
    const total = baseComparable + pse + extras
    return {
      offer: o,
      label: offerLabel(o, c.offers),
      declared,
      discount,
      fill,
      baseComparable,
      pse,
      extras,
      total,
      missingCount,
      includedCount,
      completeness: baseStats.length ? (baseStats.length - missingCount) / baseStats.length : 1,
      overMedian,
      rank: 0,
      vsBest: null,
      vsAverage: null,
      vsBudget: null,
      vsBudgetAmount: null,
      priceScore: null,
      techScore: o.techScore,
      globalScore: null,
      scoreRank: null,
      chapterTotals,
      anomalies,
    }
  })

  // On ne classe que les offres qui contiennent au moins un prix
  const priced = results.filter((r) => r.declared > 0 || r.total > 0)
  const ranked = [...priced].sort((a, b) => a.total - b.total)
  ranked.forEach((r, i) => (r.rank = i + 1))
  const best = ranked[0] ?? null
  const second = ranked[1] ?? null
  const totals = ranked.map((r) => r.total)
  const average = mean(totals)
  const budget = c.budget && c.budget > 0 ? c.budget : null
  for (const r of ranked) {
    r.vsBest = best && best.total > 0 ? r.total / best.total - 1 : null
    r.vsAverage = average ? r.total / average - 1 : null
    r.vsBudget = budget ? r.total / budget - 1 : null
    r.vsBudgetAmount = budget ? r.total - budget : null
    // Note prix proportionnelle : 20 × Pmin / P
    r.priceScore = best && r.total > 0 ? (20 * best.total) / r.total : null
    const w = Math.min(100, Math.max(0, priceWeight)) / 100
    if (r.priceScore != null) {
      r.globalScore = r.techScore != null ? w * r.priceScore + (1 - w) * r.techScore : null
    }
  }
  const scored = ranked.filter((r) => r.globalScore != null).sort((a, b) => (b.globalScore ?? 0) - (a.globalScore ?? 0))
  scored.forEach((r, i) => (r.scoreRank = i + 1))

  // — Chapitres —
  const chapterMap = new Map<string, ChapterStat>()
  for (const l of baseStats) {
    const key = l.chapterId ?? '_'
    if (!chapterMap.has(key)) chapterMap.set(key, { id: l.chapterId, label: l.chapterLabel, totals: {}, median: null })
  }
  for (const ch of chapterMap.values()) {
    const key = ch.id ?? '_'
    for (const r of results) ch.totals[r.offer.id] = r.chapterTotals[key] ?? 0
    ch.median = median(ranked.map((r) => ch.totals[r.offer.id]))
  }

  // — Optimum théorique —
  const theoreticalBest = ranked.length >= 2 ? sum(baseStats.map((l) => (l.min ?? 0) * qtyOf(l.item))) : null
  const bestBase = best ? best.declared - best.discount + best.fill : null
  const negotiationPotential = theoreticalBest != null && bestBase != null ? Math.max(0, bestBase - theoreticalBest) : null

  // — Pareto des postes —
  const totalMedian = sum(baseStats.map((l) => l.medianAmount))
  let cum = 0
  const pareto: ParetoRow[] = [...baseStats]
    .filter((l) => l.medianAmount > 0)
    .sort((a, b) => b.medianAmount - a.medianAmount)
    .map((l) => {
      const share = totalMedian ? l.medianAmount / totalMedian : 0
      cum += share
      return { item: l.item, amount: l.medianAmount, share, cumulative: cum }
    })
  const paretoCount80 = pareto.findIndex((p) => p.cumulative >= 0.8) + 1 || pareto.length

  // — Historique des versions (toutes versions confondues) —
  const companies = new Map<string, Offer[]>()
  for (const o of c.offers) {
    const k = companyKey(o.company)
    companies.set(k, [...(companies.get(k) ?? []), o])
  }
  const histories: CompanyHistory[] = []
  for (const list of companies.values()) {
    if (list.length < 2) continue
    const points = [...list]
      .sort((a, b) => a.version - b.version)
      .map((o) => {
        const declared = declaredBase(o, c.items)
        return { offerId: o.id, version: o.version, receivedAt: o.receivedAt, total: declared * (1 - (o.discountPct || 0) / 100) }
      })
    const first = points[0].total
    const last = points[points.length - 1].total
    histories.push({ company: list[0].company, points, gain: first - last, gainPct: first ? (first - last) / first : null })
  }

  const spread = best && ranked.length >= 2 ? ranked[ranked.length - 1].total / best.total - 1 : null
  const sd = stdev(totals)
  const analysis: Analysis = {
    offers: results,
    ranked,
    lines: lineStats,
    chapters: [...chapterMap.values()],
    best,
    second,
    gapBestSecond: best && second ? second.total / best.total - 1 : null,
    average,
    medianTotal: median(totals),
    spread,
    cv: sd != null && average ? sd / average : null,
    budget,
    bestVsBudget: best && budget ? best.total / budget - 1 : null,
    theoreticalBest,
    negotiationPotential,
    pareto,
    paretoCount80,
    histories,
    insights: [],
    baseLineCount: baseStats.length,
    pseLines: pseStats.map((l) => l.item),
  }
  analysis.insights = buildInsights(analysis, c)
  return analysis
}

// ————————————————————————————————————————————————————————————
// Points de vigilance générés automatiquement
// ————————————————————————————————————————————————————————————

const eur = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
const pct = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 }).format(v)

function buildInsights(a: Analysis, c: Consultation): Insight[] {
  const out: Insight[] = []
  const today = new Date().toISOString().slice(0, 10)

  if (a.best && a.second && a.gapBestSecond != null) {
    if (a.gapBestSecond < 0.02) {
      out.push({ level: 'info', text: `${a.best.label} et ${a.second.label} sont au coude-à-coude (${pct(a.gapBestSecond)} d'écart) : le technique et les délais feront la différence.` })
    } else if (a.ranked.length >= 3 && a.average && a.best.total < a.average * 0.85) {
      out.push({ level: 'warning', text: `${a.best.label} est ${pct(1 - a.best.total / a.average)} sous la moyenne des offres : vérifier la compréhension du dossier et les oublis éventuels.` })
    }
  }
  if (a.best && a.budget && a.bestVsBudget != null) {
    if (a.bestVsBudget > 0) out.push({ level: 'critical', text: `Même le moins-disant dépasse le budget de ${eur(a.best.total - a.budget)} (${pct(a.bestVsBudget)}).` })
    else out.push({ level: 'good', text: `Le moins-disant tient le budget avec une marge de ${eur(a.budget - a.best.total)}.` })
  }
  for (const r of a.offers) {
    if (r.missingCount > 0) {
      const fill = c.settings.fillMode === 'none' ? '' : ` (≈ ${eur(r.fill)} remis à niveau)`
      out.push({ level: 'warning', text: `${r.label} n'a pas chiffré ${r.missingCount} ligne${r.missingCount > 1 ? 's' : ''}${fill}.` })
    }
    if (r.offer.validUntil && r.offer.validUntil < today) {
      out.push({ level: 'warning', text: `L'offre de ${r.label} n'est plus valable depuis le ${new Date(r.offer.validUntil).toLocaleDateString('fr-FR')}.` })
    }
    if (r.offer.reserves.trim()) {
      out.push({ level: 'info', text: `${r.label} émet des réserves : « ${truncate(r.offer.reserves.trim(), 110)} »` })
    }
  }
  // Lignes déclarées « incluses » alors qu'elles pèsent lourd chez les autres
  const baseTotal = a.medianTotal ?? 0
  for (const l of a.lines) {
    if (l.item.scope !== 'base' || l.median == null) continue
    const weight = l.median * qtyOf(l.item)
    if (!baseTotal || weight < baseTotal * 0.02) continue
    for (const cell of l.cells) {
      if (cell.flag !== 'included') continue
      const r = a.offers.find((x) => x.offer.id === cell.offerId)
      if (!r) continue
      const name = [l.item.ref, l.item.label].filter(Boolean).join(' ')
      out.push({ level: 'warning', text: `${r.label} déclare « inclus » la ligne ${name}, chiffrée ≈ ${eur(weight)} par les autres : vérifier où elle est payée.` })
    }
  }
  // Les écarts les plus significatifs en montant
  const outliers: { text: string; weight: number }[] = []
  for (const l of a.lines) {
    for (const cell of l.cells) {
      if ((cell.flag === 'high' || cell.flag === 'low') && cell.deviation != null && typeof cell.price === 'number' && l.median != null) {
        const r = a.offers.find((x) => x.offer.id === cell.offerId)
        if (!r) continue
        const weight = Math.abs(cell.price - l.median) * qtyOf(l.item)
        const name = [l.item.ref, l.item.label].filter(Boolean).join(' ')
        outliers.push({
          weight,
          text: `${name} : ${r.label} ${pct(Math.abs(cell.deviation))} ${cell.flag === 'high' ? 'au-dessus' : 'en dessous'} de la médiane.`,
        })
      }
    }
  }
  outliers.sort((x, y) => y.weight - x.weight).slice(0, 4).forEach((o) => out.push({ level: 'warning', text: o.text }))
  if (a.negotiationPotential && a.best && a.negotiationPotential > a.best.total * 0.03) {
    out.push({ level: 'info', text: `En alignant ${a.best.label} sur le meilleur prix de chaque ligne, on gagnerait jusqu'à ${eur(a.negotiationPotential)} : base de négociation.` })
  }
  for (const h of a.histories) {
    if (h.gain > 0) out.push({ level: 'good', text: `${h.company} a baissé de ${eur(h.gain)} entre V${h.points[0].version} et V${h.points[h.points.length - 1].version}.` })
  }
  return out
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

// ————————————————————————————————————————————————————————————
// Statut d'une consultation
// ————————————————————————————————————————————————————————————

export type ConsultationStatus = 'preparation' | 'waiting' | 'analysis' | 'awarded'

export function statusOf(c: Consultation, today = new Date().toISOString().slice(0, 10)): ConsultationStatus {
  if (c.awardedOfferId && c.offers.some((o) => o.id === c.awardedOfferId)) return 'awarded'
  if (c.dueDate && c.dueDate < today) return 'analysis'
  if (c.offers.length > 0 || linesOf(c.items).length > 0) return c.offers.length >= 2 ? 'analysis' : 'waiting'
  return 'preparation'
}

export const STATUS_LABEL: Record<ConsultationStatus, string> = {
  preparation: 'DPGF en préparation',
  waiting: 'Offres attendues',
  analysis: 'En analyse',
  awarded: 'Attribuée',
}
