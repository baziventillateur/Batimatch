import type { Consultation } from './types'
import { analyze, linesOf, offerLabel } from './calc'

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'consultation'

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// CSV au format Excel français : séparateur « ; », décimales « , », BOM UTF-8
const cell = (v: string | number | null | undefined) => {
  if (v == null) return ''
  if (typeof v === 'number') return isFinite(v) ? String(Math.round(v * 100) / 100).replace('.', ',') : ''
  const s = String(v)
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const toCsv = (rows: (string | number | null | undefined)[][]) => '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n')

/** DPGF vierge à transmettre aux entreprises */
export function exportBlankDpgf(c: Consultation) {
  const rows: (string | number | null)[][] = [
    [c.affaire, c.lot || c.name],
    [`Remise des offres : ${c.dueDate ?? ''}`],
    [],
    ['N°', 'Désignation', 'Unité', 'Quantité', 'PU HT', 'Montant HT'],
  ]
  for (const it of c.items) {
    if (it.kind === 'chapter') rows.push([it.ref, it.label.toUpperCase()])
    else rows.push([it.ref, it.scope === 'option' ? `${it.label} (PSE)` : it.label, it.unit, it.qty, null, null])
  }
  download(`dpgf-${slug(c.lot || c.name)}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
}

/** Tableau comparatif ligne à ligne + synthèse */
export function exportComparison(c: Consultation) {
  const a = analyze(c)
  const offers = a.offers
  const head = ['N°', 'Désignation', 'Unité', 'Quantité', 'PU médian']
  offers.forEach((r) => head.push(`${r.label} PU`, `${r.label} montant`))
  const rows: (string | number | null)[][] = [[c.affaire, c.lot || c.name], [], head]
  const lineMap = new Map(a.lines.map((l) => [l.item.id, l]))
  for (const it of c.items) {
    if (it.kind === 'chapter') {
      rows.push([it.ref, it.label.toUpperCase()])
      continue
    }
    const l = lineMap.get(it.id)!
    const r: (string | number | null)[] = [it.ref, it.scope === 'option' ? `${it.label} (PSE)` : it.label, it.unit, it.qty, l.median]
    l.cells.forEach((cellv) => {
      r.push(cellv.price === 'inclus' ? 'inclus' : (cellv.price ?? 'non chiffré'), cellv.amount)
    })
    rows.push(r)
  }
  rows.push([])
  const synth: [string, (x: (typeof offers)[number]) => number | string | null][] = [
    ['Base déclarée', (x) => x.declared],
    ['Remise', (x) => -x.discount],
    ['Remise à niveau lignes non chiffrées', (x) => x.fill],
    ['PSE retenues', (x) => x.pse],
    ['Variantes et options retenues', (x) => x.extras],
    ['Total comparé HT', (x) => x.total],
    ['Rang', (x) => x.rank || null],
    ['Délai (semaines)', (x) => x.offer.durationWeeks],
    ['Note prix /20', (x) => x.priceScore],
    ['Contact', (x) => [x.offer.contact.firstName, x.offer.contact.lastName].filter(Boolean).join(' ')],
    ['Email', (x) => x.offer.contact.email],
    ['Téléphone', (x) => x.offer.contact.phone],
    ['Réserves', (x) => x.offer.reserves],
  ]
  for (const [label, fn] of synth) {
    const r: (string | number | null)[] = ['', label, '', '', '']
    offers.forEach((x) => r.push('', fn(x)))
    rows.push(r)
  }
  download(`comparatif-${slug(c.lot || c.name)}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
}

export const lineCount = (c: Consultation) => linesOf(c.items).length
export { offerLabel }
