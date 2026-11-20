// Lignes telles qu'elles sont stockées en base, et conversion vers le modèle de l'application.
import {
  DEFAULT_SETTINGS,
  type Comment,
  type CompareSettings,
  type Consultation,
  type DpgfItem,
  type Extra,
  type TechNote,
  type Offer,
  type PriceValue,
  type Profile,
  type Project,
  type Review,
  type Role,
  type Verdict,
} from '../lib/types'

export interface ProfileRow {
  id: string
  role: Role
  email: string
  first_name: string
  last_name: string
  company_name: string
  phone: string
  logo_url: string | null
}

export interface ProjectRow {
  id: string
  owner_id: string
  name: string
  reference: string
  description: string
  access_code: string
  created_at: string
  /** Projet exemple (copie du modèle proposé à chaque acheteur) */
  is_example?: boolean
  /** Date de verrouillage : le projet se consulte mais ne se modifie plus */
  locked_at?: string | null
}

/** draft = invisible des entreprises ; published = ouvert ; suspended = visible mais gelé */
export type LotStatus = 'draft' | 'published' | 'suspended'
export type AccessStatus = 'pending' | 'approved' | 'refused' | 'declined'

/** Demande d'accès d'une entreprise à un lot */
export interface LotAccessRow {
  lot_id: string
  user_id: string
  status: AccessStatus
  requested_at: string
  decided_at: string | null
  /** Motif de « ne pas répondre », visible de l'acheteur */
  comment?: string | null
}

export type NotificationKind = 'access_requested' | 'access_approved' | 'access_refused' | 'lot_declined' | 'sso_requested' | 'offer_reminder' | 'lot_published'

/** Invitation d'une entreprise par e-mail, sur un ou plusieurs lots */
export interface InvitationRow {
  id: string
  project_id: string
  email: string
  lot_ids: string[]
  /** Compte rattaché : null tant que l'entreprise ne s'est pas connectée */
  user_id: string | null
  created_at: string
  updated_at: string
}

/** Alerte de la cloche, créée par la base quand une demande d'accès évolue */
export interface NotificationRow {
  id: string
  user_id: string
  kind: NotificationKind
  project_id: string | null
  lot_id: string | null
  /** Celui qui a provoqué l'alerte */
  actor_id: string | null
  data: { project?: string; lot?: string; company?: string; contact?: string; comment?: string | null; request?: string; email?: string; users?: string; buyer?: string; due?: string }
  read_at: string | null
  created_at: string
}

/** new = à traiter ; contacted = réponse envoyée ; in_progress = activation en cours ; declined = sans suite */
export type SsoStatus = 'new' | 'contacted' | 'in_progress' | 'activated' | 'declined'
export type SsoProvider = 'microsoft' | 'other'

/** E-mail envoyé à l'entreprise : accusé de réception automatique ou réponse de l'administrateur */
export interface SsoMessageRow {
  id: string
  request_id: string
  kind: 'ack' | 'reply'
  subject: string
  body: string
  emailed_at: string | null
  created_at: string
}

/** Demande de connexion SSO déposée depuis la page de connexion */
export interface SsoRequestRow {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  user_count: string
  provider: SsoProvider
  message: string
  status: SsoStatus
  /** Note interne de l'administrateur */
  admin_note: string
  created_at: string
  updated_at: string
  messages: SsoMessageRow[]
}

export interface SsoRequestInput {
  company: string
  contact: string
  email: string
  phone: string
  users: string
  provider: SsoProvider
  message: string
}

/** Lot tel que le voit une entreprise avant d'y avoir accès : pas de DPGF */
export interface LotCatalogItem {
  id: string
  name: string
  code: string
  due_date: string | null
  status: LotStatus
  line_count: number
  access: AccessStatus | null
}

export interface LotRow {
  id: string
  project_id: string
  name: string
  code: string
  description: string
  due_date: string | null
  /** Absent tant que la base n'a pas été mise à jour : traité comme publié */
  status?: LotStatus
  items: DpgfItem[]
  position: number
  created_at: string
  updated_at: string
}

export interface LotPrivateRow {
  lot_id: string
  budget: number | null
  budget_prices: Record<string, number> | null
  settings: Partial<CompareSettings>
  awarded_offer_id: string | null
}

export interface OfferRow {
  id: string
  lot_id: string
  company_id: string | null
  source: 'platform' | 'manual'
  status: 'draft' | 'submitted'
  version: number
  company_name: string
  contact_first_name: string
  contact_last_name: string
  contact_email: string
  contact_phone: string
  logo_url: string | null
  received_at: string | null
  prices: Record<string, PriceValue>
  discount_pct: number
  extras: Extra[]
  duration_weeks: number | null
  valid_until: string | null
  reserves: string
  message: string
  tech_note?: TechNote | null
  submitted_at: string | null
  updated_at?: string
}

export interface ReviewRow {
  offer_id: string
  lot_id: string
  scores: Record<string, number>
  verdict: Verdict | null
}

export interface CommentRow {
  id: string
  offer_id: string
  lot_id: string
  author_id: string | null
  body: string
  created_at: string
}

export interface MemberRow {
  project_id: string
  user_id: string
  joined_at: string
}

// ————————————————————————— Conversions —————————————————————————

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return isFinite(n) ? n : null
}

export const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  role: r.role,
  email: r.email ?? '',
  firstName: r.first_name ?? '',
  lastName: r.last_name ?? '',
  companyName: r.company_name ?? '',
  phone: r.phone ?? '',
  logoUrl: r.logo_url ?? null,
})

export const fromProfile = (p: Partial<Profile>): Partial<ProfileRow> => {
  const out: Partial<ProfileRow> = {}
  if (p.firstName !== undefined) out.first_name = p.firstName
  if (p.lastName !== undefined) out.last_name = p.lastName
  if (p.companyName !== undefined) out.company_name = p.companyName
  if (p.phone !== undefined) out.phone = p.phone
  if (p.logoUrl !== undefined) out.logo_url = p.logoUrl
  if (p.role !== undefined) out.role = p.role
  return out
}

export const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  reference: r.reference ?? '',
  description: r.description ?? '',
  accessCode: r.access_code,
  createdAt: r.created_at,
  isExample: !!r.is_example,
})

export const toOffer = (r: OfferRow): Offer => ({
  id: r.id,
  companyId: r.company_id,
  source: r.source,
  status: r.status,
  company: r.company_name ?? '',
  contact: {
    firstName: r.contact_first_name ?? '',
    lastName: r.contact_last_name ?? '',
    email: r.contact_email ?? '',
    phone: r.contact_phone ?? '',
  },
  logoUrl: r.logo_url ?? null,
  version: r.version ?? 1,
  receivedAt: r.received_at ?? null,
  submittedAt: r.submitted_at ?? null,
  prices: r.prices ?? {},
  discountPct: num(r.discount_pct) ?? 0,
  extras: r.extras ?? [],
  durationWeeks: num(r.duration_weeks),
  validUntil: r.valid_until ?? null,
  reserves: r.reserves ?? '',
  message: r.message ?? '',
  techNote: r.tech_note ?? null,
})

export const fromOffer = (o: Offer, lotId: string): OfferRow => ({
  id: o.id,
  lot_id: lotId,
  company_id: o.companyId,
  source: o.source,
  status: o.status,
  version: o.version,
  company_name: o.company,
  contact_first_name: o.contact.firstName,
  contact_last_name: o.contact.lastName,
  contact_email: o.contact.email,
  contact_phone: o.contact.phone,
  logo_url: o.logoUrl,
  received_at: o.receivedAt,
  prices: o.prices,
  discount_pct: o.discountPct || 0,
  extras: o.extras,
  duration_weeks: o.durationWeeks,
  valid_until: o.validUntil,
  reserves: o.reserves,
  message: o.message,
  tech_note: o.techNote ?? null,
  submitted_at: o.submittedAt,
})

export const toSettings = (s: Partial<CompareSettings> | null | undefined): CompareSettings => ({
  ...DEFAULT_SETTINGS,
  ...(s ?? {}),
  criteria: s?.criteria?.length ? s.criteria : DEFAULT_SETTINGS.criteria,
  pseRetained: s?.pseRetained ?? {},
  extrasRetained: s?.extrasRetained ?? {},
})

export function toConsultation(lot: LotRow, project: Pick<ProjectRow, 'name' | 'locked_at'> | null, priv: LotPrivateRow | null, offers: OfferRow[]): Consultation {
  return {
    id: lot.id,
    projectId: lot.project_id,
    name: lot.name,
    affaire: project?.name ?? '',
    locked: !!project?.locked_at,
    lot: lot.code ?? '',
    dueDate: lot.due_date,
    status: lot.status ?? 'published',
    budget: num(priv?.budget),
    budgetPrices: priv?.budget_prices ?? {},
    description: lot.description ?? '',
    items: lot.items ?? [],
    offers: offers.map(toOffer),
    settings: toSettings(priv?.settings),
    awardedOfferId: priv?.awarded_offer_id ?? null,
    createdAt: lot.created_at,
    updatedAt: lot.updated_at,
  }
}

export const toReview = (r: ReviewRow): Review => ({ offerId: r.offer_id, scores: r.scores ?? {}, verdict: r.verdict ?? null })

export const toComment = (r: CommentRow): Comment => ({
  id: r.id,
  offerId: r.offer_id,
  body: r.body,
  createdAt: r.created_at,
  authorId: r.author_id,
})
