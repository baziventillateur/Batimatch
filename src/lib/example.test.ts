import { describe, expect, test } from 'vitest'
import { EXAMPLE_ACCOUNTS, buildExampleTemplate, materializeExample } from './example'
import { exampleSql } from './example-sql'
import { toConsultation, toReview } from '../data/rows'
import { analyze } from './calc'
import { scoreOffers } from './decision'

const t = buildExampleTemplate()

describe('projet exemple', () => {
  test('supabase/example.sql est à jour (npx vitest run -u pour le régénérer)', async () => {
    await expect(exampleSql()).toMatchFileSnapshot('../../supabase/example.sql')
  })

  test('5 à 7 lots, chaque lot publié avec au moins une entreprise', () => {
    expect(t.lots.length).toBeGreaterThanOrEqual(5)
    for (const l of t.lots.filter((x) => x.status !== 'draft')) expect(l.access.length).toBeGreaterThan(0)
  })

  test('références cohérentes : offres, évaluations, attribution, prix', () => {
    const accounts = new Set(EXAMPLE_ACCOUNTS.map((c) => c.id))
    const members = new Set(t.members.map((m) => m.user_id))
    for (const l of t.lots) {
      const ids = new Set(l.items.map((i) => i.id))
      expect(ids.size).toBe(l.items.length)
      const keys = new Set(l.offers.map((o) => o.key))
      if (l.awarded) expect(keys.has(l.awarded)).toBe(true)
      for (const r of l.reviews) expect(keys.has(r.offer)).toBe(true)
      for (const c of l.comments) expect(keys.has(c.offer)).toBe(true)
      for (const id of Object.keys(l.budget_prices)) expect(ids.has(id)).toBe(true)
      for (const a of l.access) {
        expect(accounts.has(a.user_id)).toBe(true)
        expect(members.has(a.user_id)).toBe(true)
        if (a.status === 'declined') expect((a.comment ?? '').length).toBeGreaterThanOrEqual(3)
      }
      for (const o of l.offers) {
        for (const id of Object.keys(o.prices)) expect(ids.has(id)).toBe(true)
        // Une offre déposée par une entreprise suppose son accès au lot accepté
        if (o.source === 'platform') expect(l.access.some((a) => a.user_id === o.company_id && a.status === 'approved')).toBe(true)
        else expect(o.company_id).toBeNull()
      }
      // Une seule offre par entreprise et par lot côté plateforme
      const platform = l.offers.filter((o) => o.source === 'platform').map((o) => o.company_id)
      expect(new Set(platform).size).toBe(platform.length)
    }
  })

  test('le lot attribué l’est à l’offre la mieux notée', () => {
    const rows = materializeExample(t, { ownerId: 'o', projectId: 'p', accessCode: 'ABCDEF', id: (k) => k })
    for (const lot of rows.lots) {
      const priv = rows.privates.find((p) => p.lot_id === lot.id)!
      if (!priv.awarded_offer_id) continue
      const c = toConsultation(lot, rows.project, priv, rows.offers.filter((o) => o.lot_id === lot.id))
      const reviews = Object.fromEntries(rows.reviews.filter((r) => r.lot_id === lot.id).map((r) => [r.offer_id, toReview(r)]))
      const best = scoreOffers(analyze(c), c.settings.criteria, reviews).sort((a, b) => (b.global ?? 0) - (a.global ?? 0))[0]
      expect(best.result.offer.id).toBe(priv.awarded_offer_id)
    }
  })
})
