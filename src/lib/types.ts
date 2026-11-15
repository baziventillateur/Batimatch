// Modèle de données de Batimatch.
// Un projet (affaire) regroupe des lots ; chaque lot est une demande d'offre :
// un DPGF, une date de rendu, et les offres des entreprises.

export type Role = 'buyer' | 'company'

export interface Profile {
  id: string
  role: Role
  email: string
  firstName: string
  lastName: string
  companyName: string
  phone: string
  logoUrl: string | null
}

export interface Project {
  id: string
  ownerId: string
  name: string
  reference: string
  description: string
  accessCode: string
  createdAt: string
}

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

export interface Contact {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export type OfferSource = 'platform' | 'manual'
export type OfferStatus = 'draft' | 'submitted'

export interface Offer {
  id: string
  /** Compte de l'entreprise (null pour une offre saisie par l'acheteur) */
  companyId: string | null
  source: OfferSource
  status: OfferStatus
  company: string
  contact: Contact
  logoUrl: string | null
  /** Indice de l'offre : 1 = offre initiale, 2 = après négociation… */
  version: number
  receivedAt: string | null
  submittedAt: string | null
  prices: Record<string, PriceValue>
  /** Remise commerciale en % appliquée au montant de base déclaré */
  discountPct: number
  extras: Extra[]
  durationWeeks: number | null
  validUntil: string | null
  reserves: string
  /** Message de l'entreprise à l'acheteur */
  message: string
}

export type FillMode = 'median' | 'max' | 'none'

export type CriterionKind = 'price' | 'delay' | 'manual'

/** Critère de jugement des offres */
export interface Criterion {
  id: string
  label: string
  /** Poids relatif (les poids sont ramenés à 100 %) */
  weight: number
  /** price et delay sont notés automatiquement ; manual est noté par l'acheteur sur 20 */
  kind: CriterionKind
}

export interface CompareSettings {
  /** Ne comparer que la dernière version de chaque entreprise */
  latestOnly: boolean
  /** Remise à niveau des lignes non chiffrées */
  fillMode: FillMode
  /** PSE du DPGF retenues dans le scénario (id de ligne → retenue) */
  pseRetained: Record<string, boolean>
  /** Variantes et options des entreprises intégrées au scénario (id → retenue), décidé par l'acheteur */
  extrasRetained: Record<string, boolean>
  criteria: Criterion[]
}

export interface Consultation {
  /** Identifiant du lot */
  id: string
  projectId: string
  /** Nom du lot (ex. « Lot VRD ») */
  name: string
  /** Nom du projet, affiché en en-tête */
  affaire: string
  /** Code du lot (ex. « Lot 01 – VRD ») */
  lot: string
  /** Date limite de remise des offres (AAAA-MM-JJ) */
  dueDate: string | null
  /** Budget objectif HT du lot (visible de l'acheteur seulement) */
  budget: number | null
  /** Prix unitaires budget par ligne (id ligne → montant). Privé à l'acheteur. */
  budgetPrices: Record<string, number>
  description: string
  items: DpgfItem[]
  offers: Offer[]
  settings: CompareSettings
  awardedOfferId: string | null
  createdAt: string
  updatedAt: string
}

export type Verdict = 'favori' | 'negocier' | 'ecarte'

/** Évaluation interne d'une offre par l'acheteur */
export interface Review {
  offerId: string
  scores: Record<string, number>
  verdict: Verdict | null
}

/** Commentaire interne sur une offre (acheteur uniquement) */
export interface Comment {
  id: string
  offerId: string
  body: string
  createdAt: string
  authorId: string | null
}

export const DEFAULT_CRITERIA: Criterion[] = [
  { id: 'price', label: 'Prix', weight: 60, kind: 'price' },
  { id: 'tech', label: 'Valeur technique', weight: 30, kind: 'manual' },
  { id: 'delay', label: 'Délai', weight: 10, kind: 'delay' },
]

export const DEFAULT_SETTINGS: CompareSettings = {
  latestOnly: true,
  fillMode: 'median',
  pseRetained: {},
  extrasRetained: {},
  criteria: DEFAULT_CRITERIA,
}
