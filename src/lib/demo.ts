import type { Consultation, DpgfItem, Offer, PriceValue, Review } from './types'
import { DEFAULT_CRITERIA } from './types'
import { newConsultation, newItem, newOffer } from '../store'
import { uid } from './id'

// Exemple : consultation du lot VRD d'une opération de logements (entreprises fictives).

type Row = [ref: string, label: string, unit?: string, qty?: number, refPu?: number, scope?: 'base' | 'option']

const ROWS: Row[] = [
  ['1', 'Installation et préparation'],
  ['1.1', 'Installation de chantier VRD, amenée et repli du matériel', 'ft', 1, 18000],
  ['1.2', 'Implantation, piquetage et DICT', 'ft', 1, 3500],
  ['1.3', 'Démolition des enrobés existants, évacuation comprise', 'm²', 420, 12],
  ['2', 'Terrassements'],
  ['2.1', 'Décapage de la terre végétale ép. 30 cm', 'm²', 1250, 4.5],
  ['2.2', 'Déblais en masse', 'm³', 1850, 14],
  ['2.3', 'Évacuation des terres en ISDI, transport compris', 't', 3330, 22],
  ['2.4', 'Remblai en GNT 0/31,5 compacté', 'm³', 640, 38],
  ['2.5', 'Purge de sols compressibles', 'm³', 120, 32],
  ['3', 'Réseaux'],
  ['3.1', 'Canalisation EU PVC CR8 Ø200', 'ml', 185, 95],
  ['3.2', 'Canalisation EP PVC CR8 Ø315', 'ml', 140, 120],
  ['3.3', 'Regards de visite béton Ø1000', 'u', 14, 1650],
  ['3.4', 'Fourreaux TPC Ø90 (télécom et éclairage)', 'ml', 260, 28],
  ['3.5', 'Bassin de rétention enterré 60 m³', 'ft', 1, 48000],
  ['4', 'Voirie et chaussées'],
  ['4.1', 'Couche de forme en GNT ép. 40 cm', 'm²', 980, 16],
  ['4.2', 'Grave-bitume GB3 ép. 8 cm', 'm²', 980, 24],
  ['4.3', 'Enrobé BBSG 0/10 ép. 6 cm', 'm²', 980, 19],
  ['4.4', 'Bordures béton T2', 'ml', 310, 42],
  ['4.5', 'Caniveaux CC1', 'ml', 145, 55],
  ['5', 'Aménagements et finitions'],
  ['5.1', 'Terre végétale et engazonnement', 'm²', 520, 14],
  ['5.2', 'Marquage au sol et signalisation', 'ft', 1, 6500],
  ['5.3', 'Plans de récolement géoréférencés', 'ft', 1, 4500],
  ['PSE', 'Prestations supplémentaires éventuelles'],
  ['PSE 1', 'Clôture rigide H 2,00 m et portail coulissant', 'ml', 95, 165, 'option'],
  ['PSE 2', 'Éclairage extérieur : candélabres LED', 'u', 8, 3200, 'option'],
]

// Générateur pseudo-aléatoire déterministe : la démo est identique à chaque chargement
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const round = (v: number) => (v >= 100 ? Math.round(v) : Math.round(v * 100) / 100)

export interface DemoBundle {
  consultation: Consultation
  reviews: Review[]
  comments: { offerId: string; body: string }[]
}

export function buildDemo(): DemoBundle {
  const items: DpgfItem[] = ROWS.map(([ref, label, unit, qty, , scope]) =>
    unit
      ? newItem({ ref, label, unit, qty: qty ?? null, scope: scope ?? 'base' })
      : newItem({ kind: 'chapter', ref, label, unit: '', qty: null }),
  )
  const refPu = new Map<string, number>()
  ROWS.forEach((r, i) => r[4] != null && refPu.set(items[i].id, r[4]))
  const byRef = (ref: string) => items.find((it) => it.ref === ref)!.id

  const priceSet = (seed: number, bias: number, spread: number, overrides: Record<string, PriceValue | null> = {}) => {
    const rand = rng(seed)
    const prices: Record<string, PriceValue> = {}
    for (const [id, pu] of refPu) {
      prices[id] = round(pu * bias * (1 + (rand() - 0.5) * 2 * spread))
    }
    for (const [ref, v] of Object.entries(overrides)) {
      const id = byRef(ref)
      if (v == null) delete prices[id]
      else prices[id] = v
    }
    return prices
  }

  const today = new Date()
  const d = (offset: number) => {
    const x = new Date(today)
    x.setDate(x.getDate() + offset)
    return x.toISOString().slice(0, 10)
  }

  const a1: Offer = newOffer({
    company: 'TP Val-de-Seine',
    version: 1,
    receivedAt: d(-12),
    prices: priceSet(11, 1.04, 0.08, { '4.3': 17.6, '4.2': 22.4 }),
    durationWeeks: 14,
    validUntil: d(60),
    contact: { firstName: 'Claire', lastName: 'Morel', email: 'c.morel@tp-valdeseine.example', phone: '01 39 00 00 01' },
    reserves: '',
    message: 'Conducteur de travaux dédié, démarrage possible sous 3 semaines.',
    extras: [
      { id: uid(), kind: 'variante', label: 'Enrobé avec 20 % d’agrégats recyclés (performances identiques)', amount: -6200, retained: false },
      { id: uid(), kind: 'option', label: 'Entretien des espaces verts pendant 1 an', amount: 4800, retained: false },
    ],
  })
  const a2: Offer = newOffer({
    ...a1,
    id: uid(),
    version: 2,
    receivedAt: d(-3),
    prices: Object.fromEntries(Object.entries(a1.prices).map(([k, v]) => [k, typeof v === 'number' ? round(v * 0.965) : v])),
    discountPct: 1,
    extras: a1.extras.map((e) => ({ ...e, id: uid() })),
    message: 'Offre après réunion de négociation.',
  })
  const b: Offer = newOffer({
    company: 'Réseaux Île-de-France',
    version: 1,
    receivedAt: d(-10),
    prices: priceSet(29, 0.95, 0.12, { '3.5': null, '5.3': null, '2.3': 31.5, '3.3': 1180 }),
    durationWeeks: 12,
    validUntil: d(-2),
    contact: { firstName: 'Karim', lastName: 'Benali', email: 'k.benali@reseaux-idf.example', phone: '01 30 00 00 02' },
    reserves: 'Bassin de rétention exclu (attente étude de sol G2 PRO). Évacuation chiffrée en ISDI uniquement : tout classement ISDI+ en plus-value.',
  })
  const c: Offer = newOffer({
    company: 'Bitumes & Bordures',
    version: 1,
    receivedAt: d(-9),
    prices: priceSet(47, 1.02, 0.1, { '1.2': 'inclus', '4.3': 15.8, '4.4': 36, '3.1': 128, '3.2': 158 }),
    durationWeeks: 16,
    validUntil: d(45),
    contact: { firstName: 'Julie', lastName: 'Lefèvre', email: 'j.lefevre@bitumes-bordures.example', phone: '01 34 00 00 03' },
    reserves: '',
    extras: [{ id: uid(), kind: 'variante', label: 'Bordures granit en remplacement des bordures béton T2', amount: 9400, retained: false }],
  })

  const consultation = newConsultation({
    name: 'Lot VRD',
    affaire: 'Exemple – Logements Paris 17e',
    lot: 'Lot 01 – VRD',
    dueDate: d(-14),
    budget: 375000,
    description: 'Exemple de démonstration : entreprises et montants fictifs.',
    items,
    offers: [a1, b, c, a2],
    settings: { latestOnly: true, fillMode: 'median', pseRetained: { [byRef('PSE 1')]: true }, extrasRetained: {}, criteria: DEFAULT_CRITERIA },
  })
  return {
    consultation,
    reviews: [
      { offerId: a2.id, scores: { tech: 16 }, verdict: 'favori' },
      { offerId: b.id, scores: { tech: 12 }, verdict: null },
      { offerId: c.id, scores: { tech: 14.5 }, verdict: 'negocier' },
    ],
    comments: [
      { offerId: a2.id, body: 'Mémoire technique solide, conducteur de travaux dédié. Références VRD comparables en Yvelines.' },
      { offerId: c.id, body: 'Réseaux chers : demander le détail des canalisations EU/EP avant de conclure.' },
      { offerId: b.id, body: 'Bassin exclu et offre expirée : relancer pour une offre complète.' },
    ],
  }
}
