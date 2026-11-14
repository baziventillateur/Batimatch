// Modèle de données de Batimatch.
// Une consultation = un lot mis en concurrence : un DPGF + les offres reçues.

export type ItemKind = 'chapter' | 'line'

/** base = prestation de base ; option = PSE (prestation supplémentaire éventuelle) prévue au DPGF */
export type LineScope = 'base' | 'option'

export interface DpgfItem {
  id: string
  kind: ItemKind
  /** Numérotation libre : « 2.3 », « PSE 1 »… */
  ref: string
  label: string
  unit: string
  qty: number | null
  scope: LineScope
}

/** Prix unitaire saisi : un nombre, ou « inclus » (prestation couverte sans prix propre). Absent = non chiffré. */
export type PriceValue = number | 'inclus'

export type ExtraKind = 'variante' | 'option'

/** Variante ou option proposée par l'entreprise, hors DPGF */
export interface Extra {
  id: string
  kind: ExtraKind
  label: string
  /** Montant HT. Variante : écart par rapport à la base (négatif = économie). Option : plus-value. */
  amount: number
  /** Intégrée au scénario de comparaison */
  retained: boolean
}

export interface Offer {
  id: string
  company: string
  /** Indice de l'offre : 1 = offre initiale, 2 = après négociation… */
  version: number
  receivedAt: string | null
  prices: Record<string, PriceValue>
  /** Remise commerciale en % appliquée au montant de base déclaré */
  discountPct: number
  extras: Extra[]
  durationWeeks: number | null
  validUntil: string | null
  /** Note technique sur 20 (mémoire, moyens, références…) */
  techScore: number | null
  reserves: string
  notes: string
}

export type FillMode = 'median' | 'max' | 'none'

export interface CompareSettings {
  /** Ne comparer que la dernière version de chaque entreprise */
  latestOnly: boolean
  /** Remise à niveau des lignes non chiffrées */
  fillMode: FillMode
  /** Poids du prix dans la note globale (0–100), le reste va à la note technique */
  priceWeight: number
  /** PSE du DPGF retenues dans le scénario (id de ligne → retenue) */
  pseRetained: Record<string, boolean>
}

export interface Consultation {
  id: string
  name: string
  affaire: string
  lot: string
  /** Date limite de remise des offres (AAAA-MM-JJ) */
  dueDate: string | null
  /** Budget objectif HT du lot */
  budget: number | null
  description: string
  items: DpgfItem[]
  offers: Offer[]
  settings: CompareSettings
  awardedOfferId: string | null
  createdAt: string
  updatedAt: string
}

export interface AppData {
  version: 1
  consultations: Consultation[]
}
