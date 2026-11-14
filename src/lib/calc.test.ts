import { describe, expect, it } from 'vitest'
import { analyze, median, activeOffers, statusOf } from './calc'
import { parseNumber, parsePrice, guessDpgfColumns, rowsToItems, splitClipboard, guessPriceColumn } from './parse'
import type { Consultation, DpgfItem, Offer } from './types'
import { buildDemo } from './demo'

const item = (id: string, qty: number, extra: Partial<DpgfItem> = {}): DpgfItem => ({
  id, kind: 'line', ref: id, label: id, unit: 'u', qty, scope: 'base', ...extra,
})
const offer = (id: string, company: string, prices: Offer['prices'], extra: Partial<Offer> = {}): Offer => ({
  id, company, version: 1, receivedAt: '2026-11-01', prices, discountPct: 0, extras: [],
  durationWeeks: null, validUntil: null, techScore: null, reserves: '', notes: '', ...extra,
})
const consultation = (items: DpgfItem[], offers: Offer[], settings: Partial<Consultation['settings']> = {}): Consultation => ({
  id: 'c', name: 'Test', affaire: '', lot: '', dueDate: null, budget: 1000, description: '',
  items, offers, awardedOfferId: null, createdAt: '', updatedAt: '',
  settings: { latestOnly: true, fillMode: 'median', priceWeight: 60, pseRetained: {}, ...settings },
})

describe('parseNumber', () => {
  it('lit les formats français et Excel', () => {
    expect(parseNumber('1 234,56')).toBe(1234.56)
    expect(parseNumber('1 234,5 €')).toBe(1234.5)
    expect(parseNumber('1.234,56')).toBe(1234.56)
    expect(parseNumber('1,234.56')).toBe(1234.56)
    expect(parseNumber('1234.5')).toBe(1234.5)
    expect(parseNumber('1.234.567')).toBe(1234567)
    expect(parseNumber('−6 200')).toBe(-6200)
    expect(parseNumber('(500)')).toBe(-500)
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
  })
  it('reconnaît « inclus » et « PM »', () => {
    expect(parsePrice('inclus')).toBe('inclus')
    expect(parsePrice('PM')).toBe('inclus')
    expect(parsePrice('12,5')).toBe(12.5)
  })
})

describe('collage DPGF', () => {
  it('devine les colonnes et crée chapitres et lignes', () => {
    const rows = splitClipboard('1\tTerrassements\t\t\n1.1\tDéblais en masse\tm3\t1 850\n1.2\tRemblai GNT\tm3\t640\n')
    const roles = guessDpgfColumns(rows)
    expect(roles).toEqual(['ref', 'label', 'unit', 'qty'])
    const items = rowsToItems(rows, roles)
    expect(items.map((i) => i.kind)).toEqual(['chapter', 'line', 'line'])
    expect(items[1]).toMatchObject({ unit: 'm³', qty: 1850, ref: '1.1' })
  })
  it('trouve la colonne des PU quand le total suit', () => {
    const rows = splitClipboard('10\t100\n20\t80\n5,5\t33')
    expect(guessPriceColumn(rows, [10, 4, 6])).toBe(0)
  })
})

describe('analyse comparative', () => {
  const items = [item('a', 10), item('b', 2), item('p', 1, { scope: 'option' })]
  it('calcule totaux, classement et écarts', () => {
    const c = consultation(items, [
      offer('o1', 'Alpha', { a: 10, b: 50, p: 100 }),
      offer('o2', 'Beta', { a: 12, b: 40 }),
    ])
    const a = analyze(c)
    expect(a.offers.map((r) => r.declared)).toEqual([200, 200])
    expect(a.best?.offer.id).toBe('o1') // à égalité, l'ordre de saisie départage
    expect(a.theoreticalBest).toBe(10 * 10 + 40 * 2)
    expect(a.negotiationPotential).toBe(20)
    expect(a.offers[0].priceScore).toBe(20)
  })
  it('remet à niveau les lignes non chiffrées', () => {
    const c = consultation(items, [
      offer('o1', 'Alpha', { a: 10, b: 50 }),
      offer('o2', 'Beta', { a: 12, b: 40 }),
      offer('o3', 'Gamma', { a: 11 }),
    ])
    const r = analyze(c).offers[2]
    expect(r.missingCount).toBe(1)
    expect(r.fill).toBe(45 * 2) // médiane de 50 et 40
    expect(r.total).toBe(110 + 90)
    const none = analyze(consultation(items, c.offers, { fillMode: 'none' })).offers[2]
    expect(none.total).toBe(110)
    const max = analyze(consultation(items, c.offers, { fillMode: 'max' })).offers[2]
    expect(max.fill).toBe(100)
  })
  it('intègre remise, PSE retenues et variantes retenues', () => {
    const c = consultation(
      items,
      [
        offer('o1', 'Alpha', { a: 10, b: 50, p: 100 }, {
          discountPct: 10,
          extras: [
            { id: 'e1', kind: 'variante', label: 'v', amount: -30, retained: true },
            { id: 'e2', kind: 'option', label: 'o', amount: 999, retained: false },
          ],
        }),
      ],
      { pseRetained: { p: true } },
    )
    const r = analyze(c).offers[0]
    expect(r.discount).toBe(20)
    expect(r.pse).toBe(100)
    expect(r.extras).toBe(-30)
    expect(r.total).toBe(200 - 20 + 100 - 30)
  })
  it('signale les prix anormaux par rapport à la médiane des autres', () => {
    const c = consultation(items, [
      offer('o1', 'Alpha', { a: 10, b: 50 }),
      offer('o2', 'Beta', { a: 11, b: 52 }),
      offer('o3', 'Gamma', { a: 20, b: 51 }),
    ])
    const line = analyze(c).lines[0]
    expect(line.cells[2].flag).toBe('high')
    expect(line.cells[0].isMin).toBe(true)
  })
  it('ne garde que la dernière version de chaque entreprise', () => {
    const c = consultation(items, [
      offer('o1', 'Alpha', { a: 10, b: 50 }),
      offer('o2', 'alpha ', { a: 9, b: 45 }, { version: 2 }),
      offer('o3', 'Beta', { a: 12, b: 40 }),
    ])
    expect(activeOffers(c).map((o) => o.id)).toEqual(['o2', 'o3'])
    const a = analyze(c)
    expect(a.histories).toHaveLength(1)
    expect(a.histories[0].gain).toBe(200 - 180)
    expect(activeOffers({ ...c, settings: { ...c.settings, latestOnly: false } })).toHaveLength(3)
  })
  it('calcule la note globale pondérée', () => {
    const c = consultation(items, [
      offer('o1', 'Alpha', { a: 10, b: 50 }, { techScore: 10 }),
      offer('o2', 'Beta', { a: 20, b: 50 }, { techScore: 20 }),
    ], { priceWeight: 50 })
    const a = analyze(c)
    expect(a.offers[1].priceScore).toBeCloseTo(20 * 200 / 300)
    expect(a.offers[1].globalScore).toBeCloseTo(0.5 * (20 * 200 / 300) + 10)
    expect(a.offers[1].scoreRank).toBe(1)
  })
})

describe('démo', () => {
  it('produit une analyse cohérente', () => {
    const c = buildDemo()
    const a = analyze(c)
    expect(a.ranked).toHaveLength(3)
    expect(a.histories).toHaveLength(1)
    expect(a.insights.length).toBeGreaterThan(3)
    expect(statusOf(c)).toBe('analysis')
    expect(median([3, 1, 2])).toBe(2)
  })
})
