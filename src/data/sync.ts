// Synchronisation automatique entre le cache local (store) et la base.
// Chaque modification d'un lot ouvert est envoyée après une courte pause de saisie.
import { create } from 'zustand'
import { api, errorMessage } from '.'
import { fromOffer, toComment, toConsultation, toReview } from './rows'
import { useStore } from '../store'
import type { Consultation, Offer, Review, Role } from '../lib/types'

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error'

export const useSync = create<{ status: SyncStatus; error: string | null; savedAt: number | null; retry: (() => void) | null }>(() => ({
  status: 'idle',
  error: null,
  savedAt: null,
  retry: null,
}))

/** Charge un lot depuis la base dans le cache local */
export async function loadLot(lotId: string) {
  const b = await api.getLot(lotId)
  const c = toConsultation(b.lot, b.project, b.priv, b.offers)
  const st = useStore.getState()
  st.setConsultation(c)
  st.setReviews(b.reviews.map(toReview))
  const byOffer = new Map<string, ReturnType<typeof toComment>[]>()
  for (const row of b.comments) byOffer.set(row.offer_id, [...(byOffer.get(row.offer_id) ?? []), toComment(row)])
  for (const o of b.offers) st.setComments(o.id, byOffer.get(o.id) ?? [])
  return { consultation: c, project: b.project }
}

const lotFields = (c: Consultation) => ({ name: c.name, code: c.lot, description: c.description, due_date: c.dueDate, items: c.items })
const privFields = (c: Consultation) => ({ budget: c.budget, settings: c.settings, awarded_offer_id: c.awardedOfferId })
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Surveille un lot ouvert et envoie ses modifications.
 * Acheteur : lot, données privées, offres saisies manuellement.
 * Entreprise : sa propre offre uniquement.
 */
export function startLotSync(lotId: string, role: Role, userId: string) {
  const find = () => useStore.getState().consultations.find((c) => c.id === lotId)
  let synced = find()
  let pending: Consultation | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false

  const editable = (o: Offer) => (role === 'buyer' ? o.source === 'manual' : o.source === 'platform' && o.companyId === userId)

  async function flush() {
    timer = undefined
    if (running || !pending || pending === synced) return
    running = true
    const next = pending
    const prev = synced
    useSync.setState({ status: 'saving', error: null })
    try {
      if (role === 'buyer') {
        if (!prev || !same(lotFields(prev), lotFields(next))) await api.updateLot(lotId, lotFields(next))
        if (!prev || !same(privFields(prev), privFields(next))) await api.upsertLotPrivate({ lot_id: lotId, ...privFields(next) })
      }
      for (const o of next.offers) {
        const before = prev?.offers.find((x) => x.id === o.id)
        if (before !== o && editable(o)) await api.upsertOffer(fromOffer(o, lotId))
      }
      for (const o of prev?.offers ?? []) {
        if (!next.offers.some((x) => x.id === o.id) && editable(o)) await api.deleteOffer(o.id)
      }
      synced = next
      useSync.setState({ status: 'saved', savedAt: Date.now(), retry: null })
    } catch (e) {
      useSync.setState({ status: 'error', error: errorMessage(e), retry: () => schedule(0) })
    } finally {
      running = false
      if (pending !== synced && useSync.getState().status !== 'error') schedule(400)
    }
  }

  function schedule(ms = 700) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, ms)
  }

  const unsub = useStore.subscribe((s) => {
    const cur = s.consultations.find((c) => c.id === lotId)
    if (!cur || cur === pending) return
    pending = cur
    if (cur !== synced) schedule()
  })

  return {
    /** Envoie immédiatement les modifications en attente */
    flushNow: async () => {
      if (timer) clearTimeout(timer)
      pending = find()
      await flush()
      // Une sauvegarde déjà en cours : on attend qu'elle se termine
      for (let i = 0; i < 40 && running; i++) await new Promise((r) => setTimeout(r, 100))
      if (pending !== synced) await flush()
      if (useSync.getState().status === 'error') throw new Error(useSync.getState().error ?? 'Enregistrement impossible.')
    },
    stop: () => {
      unsub()
      if (timer) {
        clearTimeout(timer)
        void flush()
      }
    },
  }
}

// ————————————————————————— Évaluation interne —————————————————————————

const reviewTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function saveReview(lotId: string, offerId: string, patch: Partial<Review>) {
  const next = useStore.getState().setReview(offerId, patch)
  const t = reviewTimers.get(offerId)
  if (t) clearTimeout(t)
  reviewTimers.set(
    offerId,
    setTimeout(async () => {
      useSync.setState({ status: 'saving', error: null })
      try {
        await api.upsertReview({ offer_id: offerId, lot_id: lotId, scores: next.scores, verdict: next.verdict })
        useSync.setState({ status: 'saved', savedAt: Date.now() })
      } catch (e) {
        useSync.setState({ status: 'error', error: errorMessage(e), retry: () => saveReview(lotId, offerId, {}) })
      }
    }, 450),
  )
}

export async function addComment(lotId: string, offerId: string, body: string) {
  const row = await api.addComment({ lot_id: lotId, offer_id: offerId, body })
  const st = useStore.getState()
  st.setComments(offerId, [...(st.comments[offerId] ?? []), toComment(row)])
}

export async function deleteComment(offerId: string, id: string) {
  await api.deleteComment(id)
  const st = useStore.getState()
  st.setComments(offerId, (st.comments[offerId] ?? []).filter((c) => c.id !== id))
}
