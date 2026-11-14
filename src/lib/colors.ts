import type { Consultation } from './types'
import { companyKey } from './calc'

/** Palette catégorielle validée (ordre fixe, jamais recyclée) : une couleur par entreprise. */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
export const OTHER = '#9aa5b1'

/** La couleur suit l'entreprise (ordre de première saisie), pas son rang. */
export function companyColor(c: Consultation, company: string): string {
  const keys: string[] = []
  for (const o of c.offers) {
    const k = companyKey(o.company)
    if (!keys.includes(k)) keys.push(k)
  }
  const i = keys.indexOf(companyKey(company))
  return i >= 0 && i < SERIES.length ? SERIES[i] : OTHER
}

/** Échelle divergente (moins cher en bleu, plus cher en rouge, gris neutre au centre) */
export const DIVERGING = [
  { max: -0.2, color: '#b7d3f6', label: '≤ −20 %' },
  { max: -0.08, color: '#d6e6fa', label: '−20 à −8 %' },
  { max: -0.02, color: '#ebf2fb', label: '−8 à −2 %' },
  { max: 0.02, color: '#f2f2f0', label: '± 2 %' },
  { max: 0.08, color: '#fbeceb', label: '+2 à +8 %' },
  { max: 0.2, color: '#f7d4d1', label: '+8 à +20 %' },
  { max: Infinity, color: '#f0b2ad', label: '≥ +20 %' },
]

export function divergingColor(dev: number | null): string | undefined {
  if (dev == null || !isFinite(dev)) return undefined
  return DIVERGING.find((s) => dev <= s.max)?.color
}
