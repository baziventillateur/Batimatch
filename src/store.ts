import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppData, Consultation, DpgfItem, Extra, Offer, PriceValue } from './lib/types'
import { uid } from './lib/id'
import { companyKey } from './lib/calc'

export const newConsultation = (partial: Partial<Consultation> = {}): Consultation => {
  const now = new Date().toISOString()
  return {
    id: uid(),
    name: '',
    affaire: '',
    lot: '',
    dueDate: null,
    budget: null,
    description: '',
    items: [],
    offers: [],
    settings: { latestOnly: true, fillMode: 'median', priceWeight: 60, pseRetained: {} },
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
  company: '',
  version: 1,
  receivedAt: new Date().toISOString().slice(0, 10),
  prices: {},
  discountPct: 0,
  extras: [],
  durationWeeks: null,
  validUntil: null,
  techScore: null,
  reserves: '',
  notes: '',
  ...partial,
})

interface State {
  consultations: Consultation[]
  addConsultation: (c: Consultation) => void
  updateConsultation: (id: string, patch: Partial<Consultation>) => void
  removeConsultation: (id: string) => void
  duplicateConsultation: (id: string) => string | null
  replaceAll: (data: Consultation[]) => void
  mergeConsultations: (data: Consultation[]) => void

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
  /** Crée la version suivante d'une offre (copie des prix) pour saisir une offre négociée */
  newVersion: (cid: string, offerId: string) => string | null
}

const touch = (c: Consultation): Consultation => ({ ...c, updatedAt: new Date().toISOString() })

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const patchC = (cid: string, fn: (c: Consultation) => Consultation) =>
        set((s) => ({ consultations: s.consultations.map((c) => (c.id === cid ? touch(fn(c)) : c)) }))
      const patchO = (cid: string, oid: string, fn: (o: Offer) => Offer) =>
        patchC(cid, (c) => ({ ...c, offers: c.offers.map((o) => (o.id === oid ? fn(o) : o)) }))

      return {
        consultations: [],
        addConsultation: (c) => set((s) => ({ consultations: [c, ...s.consultations] })),
        updateConsultation: (id, patch) => patchC(id, (c) => ({ ...c, ...patch })),
        removeConsultation: (id) => set((s) => ({ consultations: s.consultations.filter((c) => c.id !== id) })),
        duplicateConsultation: (id) => {
          const src = get().consultations.find((c) => c.id === id)
          if (!src) return null
          // Copie du DPGF seul : nouveaux identifiants, sans les offres
          const idMap = new Map<string, string>()
          const items = src.items.map((it) => {
            const nid = uid()
            idMap.set(it.id, nid)
            return { ...it, id: nid }
          })
          const copy = newConsultation({
            name: `${src.name} (copie)`,
            affaire: src.affaire,
            lot: src.lot,
            budget: src.budget,
            description: src.description,
            items,
            settings: { ...src.settings, pseRetained: {} },
          })
          set((s) => ({ consultations: [copy, ...s.consultations] }))
          return copy.id
        },
        replaceAll: (data) => set({ consultations: data }),
        mergeConsultations: (data) =>
          set((s) => {
            const ids = new Set(data.map((c) => c.id))
            return { consultations: [...data, ...s.consultations.filter((c) => !ids.has(c.id))] }
          }),

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
              if (!(itemId in o.prices)) return o
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
            version: maxV + 1,
            receivedAt: new Date().toISOString().slice(0, 10),
            prices: { ...src.prices },
            extras: src.extras.map((e) => ({ ...e, id: uid() })),
          })
          patchC(cid, (x) => ({ ...x, offers: [...x.offers, copy] }))
          return copy.id
        },
      }
    },
    {
      name: 'batimatch:v1',
      version: 1,
      partialize: (s) => ({ consultations: s.consultations }),
    },
  ),
)

export const useConsultation = (id: string | undefined) =>
  useStore((s) => (id ? s.consultations.find((c) => c.id === id) : undefined))

export const exportData = (consultations: Consultation[]): AppData => ({ version: 1, consultations })
