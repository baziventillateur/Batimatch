import { create } from 'zustand'
import type { Comment, Consultation, DpgfItem, Extra, Offer, PriceValue, Review } from './lib/types'
import { DEFAULT_SETTINGS } from './lib/types'
import { uid } from './lib/id'
import { companyKey } from './lib/calc'

export const newConsultation = (partial: Partial<Consultation> = {}): Consultation => {
  const now = new Date().toISOString()
  return {
    id: uid(),
    projectId: '',
    name: '',
    affaire: '',
    lot: '',
    dueDate: null,
    budget: null,
    description: '',
    items: [],
    offers: [],
    settings: { ...DEFAULT_SETTINGS },
    awardedOfferId: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

export const newItem = (partial: Partial<DpgfItem> = {}): DpgfItem => ({
  id: uid(),
  kind: 'line',
  ref: '',
  label: '',
  unit: 'u',
  qty: null,
  scope: 'base',
  ...partial,
})

export const newOffer = (partial: Partial<Offer> = {}): Offer => ({
  id: uid(),
  companyId: null,
  source: 'manual',
  status: 'submitted',
  company: '',
  contact: { firstName: '', lastName: '', email: '', phone: '' },
  logoUrl: null,
  version: 1,
  receivedAt: new Date().toISOString().slice(0, 10),
  submittedAt: null,
  prices: {},
  discountPct: 0,
  extras: [],
  durationWeeks: null,
  validUntil: null,
  reserves: '',
  message: '',
  ...partial,
})

interface State {
  /** Lots ouverts (cache local synchronisé avec la base) */
  consultations: Consultation[]
  reviews: Record<string, Review>
  comments: Record<string, Comment[]>

  setConsultation: (c: Consultation) => void
  dropConsultation: (id: string) => void
  updateConsultation: (id: string, patch: Partial<Consultation>) => void

  // DPGF
  setItems: (cid: string, items: DpgfItem[]) => void
  updateItem: (cid: string, itemId: string, patch: Partial<DpgfItem>) => void
  insertItems: (cid: string, items: DpgfItem[], afterId?: string | null) => void
  removeItem: (cid: string, itemId: string) => void
  moveItem: (cid: string, itemId: string, delta: number) => void

  // Offres
  addOffer: (cid: string, offer: Offer) => void
  updateOffer: (cid: string, offerId: string, patch: Partial<Offer>) => void
  removeOffer: (cid: string, offerId: string) => void
  setPrice: (cid: string, offerId: string, itemId: string, value: PriceValue | null) => void
  setPrices: (cid: string, offerId: string, values: Record<string, PriceValue | null>) => void
  addExtra: (cid: string, offerId: string, extra: Extra) => void
  updateExtra: (cid: string, offerId: string, extraId: string, patch: Partial<Extra>) => void
  removeExtra: (cid: string, offerId: string, extraId: string) => void
  /** Crée la version suivante d'une offre (copie des prix), saisie par l'acheteur après négociation */
  newVersion: (cid: string, offerId: string) => string | null

  // Évaluation interne
  setReviews: (list: Review[]) => void
  setReview: (offerId: string, patch: Partial<Review>) => Review
  setComments: (offerId: string, list: Comment[]) => void
}

const touch = (c: Consultation): Consultation => ({ ...c, updatedAt: new Date().toISOString() })

export const useStore = create<State>()((set, get) => {
  const patchC = (cid: string, fn: (c: Consultation) => Consultation) =>
    set((s) => ({ consultations: s.consultations.map((c) => (c.id === cid ? touch(fn(c)) : c)) }))
  const patchO = (cid: string, oid: string, fn: (o: Offer) => Offer) =>
    patchC(cid, (c) => ({ ...c, offers: c.offers.map((o) => (o.id === oid ? fn(o) : o)) }))

  return {
    consultations: [],
    reviews: {},
    comments: {},

    setConsultation: (c) => set((s) => ({ consultations: [c, ...s.consultations.filter((x) => x.id !== c.id)] })),
    dropConsultation: (id) => set((s) => ({ consultations: s.consultations.filter((c) => c.id !== id) })),
    updateConsultation: (id, patch) => patchC(id, (c) => ({ ...c, ...patch })),

    setItems: (cid, items) => patchC(cid, (c) => ({ ...c, items })),
    updateItem: (cid, itemId, patch) =>
      patchC(cid, (c) => ({ ...c, items: c.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) })),
    insertItems: (cid, items, afterId) =>
      patchC(cid, (c) => {
        const idx = afterId ? c.items.findIndex((it) => it.id === afterId) : -1
        const at = idx >= 0 ? idx + 1 : c.items.length
        return { ...c, items: [...c.items.slice(0, at), ...items, ...c.items.slice(at)] }
      }),
    removeItem: (cid, itemId) =>
      patchC(cid, (c) => ({
        ...c,
        items: c.items.filter((it) => it.id !== itemId),
        offers: c.offers.map((o) => {
          if (!(itemId in o.prices) || o.source !== 'manual') return o
          const prices = { ...o.prices }
          delete prices[itemId]
          return { ...o, prices }
        }),
      })),
    moveItem: (cid, itemId, delta) =>
      patchC(cid, (c) => {
        const i = c.items.findIndex((it) => it.id === itemId)
        const j = i + delta
        if (i < 0 || j < 0 || j >= c.items.length) return c
        const items = [...c.items]
        ;[items[i], items[j]] = [items[j], items[i]]
        return { ...c, items }
      }),

    addOffer: (cid, offer) => patchC(cid, (c) => ({ ...c, offers: [...c.offers, offer] })),
    updateOffer: (cid, oid, patch) => patchO(cid, oid, (o) => ({ ...o, ...patch })),
    removeOffer: (cid, oid) =>
      patchC(cid, (c) => ({
        ...c,
        offers: c.offers.filter((o) => o.id !== oid),
        awardedOfferId: c.awardedOfferId === oid ? null : c.awardedOfferId,
      })),
    setPrice: (cid, oid, itemId, value) =>
      patchO(cid, oid, (o) => {
        const prices = { ...o.prices }
        if (value == null) delete prices[itemId]
        else prices[itemId] = value
        return { ...o, prices }
      }),
    setPrices: (cid, oid, values) =>
      patchO(cid, oid, (o) => {
        const prices = { ...o.prices }
        for (const [k, v] of Object.entries(values)) {
          if (v == null) delete prices[k]
          else prices[k] = v
        }
        return { ...o, prices }
      }),
    addExtra: (cid, oid, extra) => patchO(cid, oid, (o) => ({ ...o, extras: [...o.extras, extra] })),
    updateExtra: (cid, oid, eid, patch) =>
      patchO(cid, oid, (o) => ({ ...o, extras: o.extras.map((e) => (e.id === eid ? { ...e, ...patch } : e)) })),
    removeExtra: (cid, oid, eid) => patchO(cid, oid, (o) => ({ ...o, extras: o.extras.filter((e) => e.id !== eid) })),
    newVersion: (cid, oid) => {
      const c = get().consultations.find((x) => x.id === cid)
      const src = c?.offers.find((o) => o.id === oid)
      if (!c || !src) return null
      const maxV = Math.max(...c.offers.filter((o) => companyKey(o.company) === companyKey(src.company)).map((o) => o.version))
      const copy = newOffer({
        ...src,
        id: uid(),
        companyId: null,
        source: 'manual',
        status: 'submitted',
        version: maxV + 1,
        receivedAt: new Date().toISOString().slice(0, 10),
        submittedAt: null,
        prices: { ...src.prices },
        extras: src.extras.map((e) => ({ ...e, id: uid() })),
      })
      patchC(cid, (x) => ({ ...x, offers: [...x.offers, copy] }))
      return copy.id
    },

    setReviews: (list) => set((s) => ({ reviews: { ...s.reviews, ...Object.fromEntries(list.map((r) => [r.offerId, r])) } })),
    setReview: (offerId, patch) => {
      const cur = get().reviews[offerId] ?? { offerId, scores: {}, verdict: null }
      const next: Review = { ...cur, ...patch, scores: { ...cur.scores, ...(patch.scores ?? {}) } }
      set((s) => ({ reviews: { ...s.reviews, [offerId]: next } }))
      return next
    },
    setComments: (offerId, list) => set((s) => ({ comments: { ...s.comments, [offerId]: list } })),
  }
})

export const useConsultation = (id: string | undefined) =>
  useStore((s) => (id ? s.consultations.find((c) => c.id === id) : undefined))
