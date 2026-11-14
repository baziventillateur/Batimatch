import type { DpgfItem, PriceValue } from './types'
import { uid } from './id'

const INCLUDED_WORDS = /^(inclus|incl\.?|compris|pm|p\.m\.?|i)$/i

/**
 * Lit un nombre saisi « à la française » ou copié depuis Excel :
 * « 1 234,56 », « 1.234,56 », « 1234.56 », « 12 € », « 1 234,5 € HT ».
 * Renvoie null si vide ou illisible.
 */
export function parseNumber(raw: string | number | null | undefined): number | null {
  if (raw == null) return null
  if (typeof raw === 'number') return isFinite(raw) ? raw : null
  let s = String(raw)
    .replace(/[  \s]/g, '')
    .replace(/€|eur|ht|ttc/gi, '')
    .trim()
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  s = s.replace(/^[−–]/, '-')
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // Le dernier séparateur est le séparateur décimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (hasComma) {
    const parts = s.split(',')
    s = parts.length > 2 ? parts.join('') : s.replace(',', '.')
  } else if (hasDot) {
    const parts = s.split('.')
    // « 1.234.567 » = séparateurs de milliers
    if (parts.length > 2) s = parts.join('')
  }
  if (!/^-?\d*\.?\d+$/.test(s)) return null
  const n = Number(s)
  if (!isFinite(n)) return null
  return negative ? -n : n
}

/** Lit un prix unitaire : nombre, ou « inclus / PM / compris ». */
export function parsePrice(raw: string): PriceValue | null {
  const t = raw.trim()
  if (!t) return null
  if (INCLUDED_WORDS.test(t)) return 'inclus'
  return parseNumber(t)
}

/** Découpe un collage Excel / Sheets en lignes et cellules. */
export function splitClipboard(text: string): string[][] {
  const rows = text.replace(/\r\n?/g, '\n').split('\n')
  while (rows.length && !rows[rows.length - 1].trim()) rows.pop()
  return rows.map((r) => r.split('\t').map((c) => c.trim()))
}

export const UNITS = ['u', 'ens', 'ft', 'm', 'ml', 'm²', 'm³', 'kg', 't', 'h', 'j', 'sem', 'mois', 'l'] as const

const UNIT_ALIASES: Record<string, string> = {
  m2: 'm²', 'm^2': 'm²', mc: 'm²', m3: 'm³', 'm^3': 'm³', mcube: 'm³',
  forfait: 'ft', fft: 'ft', ff: 'ft', f: 'ft', ens: 'ens', ensemble: 'ens',
  unite: 'u', unité: 'u', un: 'u', u: 'u', pce: 'u', pc: 'u', 'u.': 'u',
  ml: 'ml', mètre: 'm', metre: 'm', m: 'm', kg: 'kg', t: 't', tonne: 't', to: 't',
  h: 'h', heure: 'h', j: 'j', jour: 'j', sem: 'sem', mois: 'mois', l: 'l', litre: 'l',
}

export function normalizeUnit(raw: string): string {
  const k = raw.trim().toLowerCase()
  if (!k) return ''
  return UNIT_ALIASES[k] ?? raw.trim()
}

const looksLikeUnit = (s: string) => {
  const k = s.trim().toLowerCase()
  return k.length > 0 && k.length <= 8 && (k in UNIT_ALIASES || (UNITS as readonly string[]).includes(k))
}
const looksLikeRef = (s: string) => /^[A-Za-z]{0,4}\s?[\d]+([.-][\dA-Za-z]+)*\.?$/.test(s.trim()) && s.trim().length <= 12

export type ColumnRole = 'ref' | 'label' | 'unit' | 'qty' | 'ignore'

/** Devine le rôle de chaque colonne d'un collage de DPGF. */
export function guessDpgfColumns(rows: string[][]): ColumnRole[] {
  const width = Math.max(0, ...rows.map((r) => r.length))
  const stats = Array.from({ length: width }, (_, i) => {
    const cells = rows.map((r) => r[i] ?? '').filter((c) => c !== '')
    const n = cells.length || 1
    return {
      i,
      numeric: cells.filter((c) => parseNumber(c) != null).length / n,
      unit: cells.filter(looksLikeUnit).length / n,
      ref: cells.filter(looksLikeRef).length / n,
      avgLen: cells.reduce((a, c) => a + c.length, 0) / n,
      filled: cells.length,
    }
  })
  const roles: ColumnRole[] = Array(width).fill('ignore')
  if (!width) return roles
  // Désignation = colonne de texte la plus longue
  const label = [...stats].sort((a, b) => b.avgLen * (1 - b.numeric) - a.avgLen * (1 - a.numeric))[0]
  roles[label.i] = 'label'
  const unit = stats.filter((s) => s.i !== label.i && s.unit >= 0.5).sort((a, b) => b.unit - a.unit)[0]
  if (unit) roles[unit.i] = 'unit'
  const ref = stats.filter((s) => s.i < label.i && roles[s.i] === 'ignore' && s.ref >= 0.5)[0]
  if (ref) roles[ref.i] = 'ref'
  // Quantité = première colonne numérique après la désignation (et l'unité si présente)
  const after = unit ? Math.max(label.i, unit.i) : label.i
  const qty = stats.filter((s) => s.i > after && roles[s.i] === 'ignore' && s.numeric >= 0.5)[0]
    ?? stats.filter((s) => roles[s.i] === 'ignore' && s.numeric >= 0.5 && s.i > label.i)[0]
  if (qty) roles[qty.i] = 'qty'
  return roles
}

/** Construit des lignes de DPGF depuis un collage. Une ligne sans unité ni quantité devient un chapitre. */
export function rowsToItems(rows: string[][], roles: ColumnRole[], chaptersFromEmpty = true): DpgfItem[] {
  const col = (r: string[], role: ColumnRole) => {
    const i = roles.indexOf(role)
    return i >= 0 ? (r[i] ?? '').trim() : ''
  }
  const out: DpgfItem[] = []
  for (const r of rows) {
    const label = col(r, 'label')
    const ref = col(r, 'ref')
    const unit = normalizeUnit(col(r, 'unit'))
    const qty = parseNumber(col(r, 'qty'))
    if (!label && !ref) continue
    const isChapter = chaptersFromEmpty && !unit && qty == null
    out.push({
      id: uid(),
      kind: isChapter ? 'chapter' : 'line',
      ref,
      label: label || ref,
      unit: isChapter ? '' : unit,
      qty: isChapter ? null : qty,
      scope: /^(pse|option|opt\.?)\b/i.test(ref) || /^(pse|option)\b/i.test(label) ? 'option' : 'base',
    })
  }
  return out
}

/**
 * Dans un collage de prix à plusieurs colonnes, devine celle des prix unitaires.
 * Si une colonne vaut ≈ quantité × une autre, l'autre est le PU.
 */
export function guessPriceColumn(rows: string[][], qtys: (number | null)[]): number {
  const width = Math.max(0, ...rows.map((r) => r.length))
  if (width <= 1) return 0
  const numericCols: number[] = []
  for (let i = 0; i < width; i++) {
    const cells = rows.map((r) => r[i] ?? '').filter(Boolean)
    if (cells.length && cells.filter((c) => parsePrice(c) != null).length / cells.length >= 0.6) numericCols.push(i)
  }
  if (!numericCols.length) return width - 1
  // Recherche d'une paire (PU, total) telle que total ≈ qty × PU
  for (const pu of numericCols) {
    for (const tot of numericCols) {
      if (pu === tot) continue
      let ok = 0
      let seen = 0
      rows.forEach((r, k) => {
        const p = parseNumber(r[pu] ?? '')
        const t = parseNumber(r[tot] ?? '')
        const q = qtys[k]
        if (p == null || t == null || q == null || q === 0) return
        seen++
        if (Math.abs(p * q - t) <= Math.max(1, Math.abs(t) * 0.01)) ok++
      })
      if (seen >= 2 && ok / seen >= 0.7) return pu
    }
  }
  return numericCols.length >= 2 ? numericCols[numericCols.length - 2] : numericCols[0]
}
