// Aide à la décision : notation multicritère et points forts / points faibles de chaque offre.
import type { Analysis, OfferResult } from './calc'
import type { Criterion, Review } from './types'

export interface CriterionScore {
  criterion: Criterion
  /** Note sur 20, null si non notée */
  score: number | null
  auto: boolean
}

export interface ScoredOffer {
  result: OfferResult
  scores: CriterionScore[]
  /** Note globale pondérée sur 20 (critères notés uniquement) */
  global: number | null
  /** Tous les critères sont notés */
  complete: boolean
  rank: number | null
  verdict: Review['verdict']
}

export function scoreOffers(a: Analysis, criteria: Criterion[], reviews: Record<string, Review>): ScoredOffer[] {
  const durations = a.ranked.map((r) => r.offer.durationWeeks).filter((d): d is number => d != null && d > 0)
  const minDuration = durations.length ? Math.min(...durations) : null
  const list: ScoredOffer[] = a.ranked.map((r) => {
    const review = reviews[r.offer.id]
    const scores: CriterionScore[] = criteria.map((cr) => {
      if (cr.kind === 'price') return { criterion: cr, score: r.priceScore, auto: true }
      if (cr.kind === 'delay') {
        const d = r.offer.durationWeeks
        return { criterion: cr, score: d && minDuration ? (20 * minDuration) / d : null, auto: true }
      }
      const v = review?.scores[cr.id]
      return { criterion: cr, score: typeof v === 'number' ? v : null, auto: false }
    })
    const weighted = scores.filter((s) => s.score != null && s.criterion.weight > 0)
    const wSum = weighted.reduce((t, s) => t + s.criterion.weight, 0)
    const global = wSum ? weighted.reduce((t, s) => t + s.criterion.weight * (s.score as number), 0) / wSum : null
    return {
      result: r,
      scores,
      global,
      complete: scores.every((s) => s.score != null || s.criterion.weight === 0),
      rank: null,
      verdict: review?.verdict ?? null,
    }
  })
  // Classement : les offres écartées passent en dernier
  const ordered = [...list].sort((x, y) => {
    const ex = x.verdict === 'ecarte' ? 1 : 0
    const ey = y.verdict === 'ecarte' ? 1 : 0
    if (ex !== ey) return ex - ey
    return (y.global ?? -1) - (x.global ?? -1) || x.result.total - y.result.total
  })
  ordered.forEach((s, i) => (s.rank = s.verdict === 'ecarte' ? null : i + 1))
  return ordered
}

export const totalWeight = (criteria: Criterion[]) => criteria.reduce((t, c) => t + Math.max(0, c.weight), 0)

export interface Point {
  text: string
}

/** Points forts et points faibles, tirés de l'analyse des prix et des conditions de l'offre */
export function strengthsAndWeaknesses(a: Analysis, r: OfferResult) {
  const plus: string[] = []
  const minus: string[] = []
  const idx = a.offers.indexOf(r)
  const durations = a.ranked.map((x) => x.offer.durationWeeks).filter((d): d is number => d != null)
  const today = new Date().toISOString().slice(0, 10)

  if (r.rank === 1) plus.push('Moins-disant après remise à niveau')
  else if (r.vsBest != null && r.vsBest > 0.05) minus.push(`${Math.round(r.vsBest * 100)} % au-dessus du moins-disant`)
  if (r.vsBudget != null) {
    if (r.vsBudget <= 0) plus.push(`Sous le budget de ${Math.round(-r.vsBudget * 100)} %`)
    else minus.push(`Dépasse le budget de ${Math.round(r.vsBudget * 100)} %`)
  }
  const bestLines = a.lines.filter((l) => l.item.scope === 'base' && l.cells[idx]?.isMin).length
  if (bestLines > 0 && a.ranked.length > 1) plus.push(`Meilleur prix sur ${bestLines} ligne${bestLines > 1 ? 's' : ''}`)
  if (r.missingCount === 0) plus.push('Offre complète')
  else minus.push(`${r.missingCount} ligne${r.missingCount > 1 ? 's' : ''} non chiffrée${r.missingCount > 1 ? 's' : ''}`)
  const high = a.lines.filter((l) => l.cells[idx]?.flag === 'high').length
  if (high > 0) minus.push(`${high} prix très au-dessus de la médiane`)
  const d = r.offer.durationWeeks
  if (d != null && durations.length > 1) {
    if (d === Math.min(...durations)) plus.push(`Délai le plus court (${d} sem.)`)
    else if (d === Math.max(...durations)) minus.push(`Délai le plus long (${d} sem.)`)
  }
  const variants = r.offer.extras.filter((e) => e.kind === 'variante')
  if (variants.some((e) => e.amount < 0)) plus.push(`Propose ${variants.length > 1 ? 'des variantes' : 'une variante'} d’économie`)
  if (r.offer.reserves.trim()) minus.push('Émet des réserves')
  if (r.offer.validUntil && r.offer.validUntil < today) minus.push('Offre expirée')
  // Chapitre où l'entreprise est la moins chère
  if (a.ranked.length > 1) {
    const cheapest = a.chapters.find((ch) => {
      const v = ch.totals[r.offer.id]
      return v > 0 && a.ranked.every((x) => x.offer.id === r.offer.id || (ch.totals[x.offer.id] ?? 0) >= v)
    })
    if (cheapest) plus.push(`La moins chère sur « ${cheapest.label} »`)
  }
  return { plus, minus }
}
