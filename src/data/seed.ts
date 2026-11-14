import { api } from '.'
import { fromOffer } from './rows'
import { buildDemo } from '../lib/demo'

/** Crée un projet d'exemple complet (lot VRD, 3 entreprises fictives) dans le compte de l'acheteur. */
export async function seedDemoProject(): Promise<{ projectId: string; lotId: string }> {
  const { consultation: c, reviews, comments } = buildDemo()
  const project = await api.createProject({
    name: c.affaire,
    reference: 'DÉMO',
    description: 'Projet d’exemple : entreprises et montants fictifs. Vous pouvez le supprimer.',
  })
  const lot = await api.createLot({
    project_id: project.id,
    name: c.name,
    code: c.lot,
    due_date: c.dueDate,
    description: c.description,
    items: c.items,
    position: 0,
  })
  await api.upsertLotPrivate({ lot_id: lot.id, budget: c.budget, settings: c.settings, awarded_offer_id: null })
  for (const o of c.offers) await api.upsertOffer(fromOffer(o, lot.id))
  for (const r of reviews) await api.upsertReview({ offer_id: r.offerId, lot_id: lot.id, scores: r.scores, verdict: r.verdict })
  for (const cm of comments) await api.addComment({ lot_id: lot.id, offer_id: cm.offerId, body: cm.body })
  return { projectId: project.id, lotId: lot.id }
}
