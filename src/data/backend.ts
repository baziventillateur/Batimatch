import type { CommentRow, LotPrivateRow, LotRow, MemberRow, OfferRow, ProfileRow, ProjectRow, ReviewRow } from './rows'
import type { Role } from '../lib/types'

export interface SignUpInput {
  email: string
  password: string
  role: Role
  firstName: string
  lastName: string
  companyName: string
  phone: string
}

/** Offre vue depuis la page d'un projet (sans le détail des prix) */
export type OfferLite = Pick<OfferRow, 'id' | 'lot_id' | 'company_id' | 'source' | 'status' | 'company_name' | 'logo_url' | 'submitted_at' | 'updated_at' | 'version'> & {
  prices: OfferRow['prices']
  discount_pct: number
}

export interface ProjectBundle {
  project: ProjectRow
  owner: ProfileRow | null
  lots: LotRow[]
  /** Données privées des lots (acheteur seulement) */
  privates: LotPrivateRow[]
  /** Offres visibles : toutes les offres envoyées (acheteur) ou ses propres offres (entreprise) */
  offers: OfferLite[]
  /** Entreprises inscrites au projet (acheteur seulement) */
  members: (MemberRow & { profile: ProfileRow | null })[]
}

export interface ProjectListItem {
  project: ProjectRow
  lots: Pick<LotRow, 'id' | 'name' | 'code' | 'due_date'>[]
  offers: Pick<OfferRow, 'id' | 'lot_id' | 'status' | 'company_id'>[]
}

export interface LotBundle {
  project: ProjectRow
  lot: LotRow
  priv: LotPrivateRow | null
  offers: OfferRow[]
  reviews: ReviewRow[]
  comments: CommentRow[]
}

export interface Backend {
  readonly kind: 'supabase' | 'mock'
  // Authentification
  getUserId(): Promise<string | null>
  onAuthChange(cb: (userId: string | null) => void): () => void
  signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  resetPassword(email: string): Promise<void>
  /** Appelé quand l'utilisateur revient par le lien « mot de passe oublié » */
  onPasswordRecovery(cb: () => void): () => void
  updatePassword(password: string): Promise<void>
  // Profil
  getProfile(id: string): Promise<ProfileRow | null>
  updateProfile(id: string, patch: Partial<ProfileRow>): Promise<ProfileRow>
  uploadImage(userId: string, path: string, file: Blob): Promise<string>
  // Projets
  listProjects(): Promise<ProjectListItem[]>
  createProject(input: Pick<ProjectRow, 'name' | 'reference' | 'description'>): Promise<ProjectRow>
  updateProject(id: string, patch: Partial<Pick<ProjectRow, 'name' | 'reference' | 'description'>>): Promise<void>
  deleteProject(id: string): Promise<void>
  getProject(id: string): Promise<ProjectBundle>
  joinProject(code: string): Promise<string>
  removeMember(projectId: string, userId: string): Promise<void>
  // Lots
  createLot(input: Pick<LotRow, 'project_id' | 'name' | 'code' | 'due_date' | 'description' | 'items' | 'position'> & { id?: string }): Promise<LotRow>
  updateLot(id: string, patch: Partial<Pick<LotRow, 'name' | 'code' | 'description' | 'due_date' | 'items' | 'position'>>): Promise<void>
  deleteLot(id: string): Promise<void>
  upsertLotPrivate(row: LotPrivateRow): Promise<void>
  getLot(id: string): Promise<LotBundle>
  // Offres
  upsertOffer(row: OfferRow): Promise<void>
  deleteOffer(id: string): Promise<void>
  // Évaluation interne
  upsertReview(row: ReviewRow): Promise<void>
  addComment(row: Omit<CommentRow, 'id' | 'created_at' | 'author_id'>): Promise<CommentRow>
  deleteComment(id: string): Promise<void>
}

/** Message d'erreur lisible pour l'utilisateur */
export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (/invalid login credentials/i.test(raw)) return 'Email ou mot de passe incorrect.'
  if (/email not confirmed/i.test(raw)) return 'Confirmez d’abord votre adresse : un lien vous a été envoyé par email.'
  if (/user already registered/i.test(raw)) return 'Un compte existe déjà avec cet email. Connectez-vous.'
  if (/password should be at least/i.test(raw)) return 'Le mot de passe doit contenir au moins 6 caractères.'
  if (/rate limit/i.test(raw)) return 'Trop de tentatives. Réessayez dans quelques minutes.'
  if (/row-level security|violates row-level/i.test(raw)) return 'Action refusée : la date de rendu est peut-être dépassée, ou vous n’avez pas les droits.'
  if (/failed to fetch|network/i.test(raw)) return 'Connexion impossible. Vérifiez votre réseau.'
  return raw
}
