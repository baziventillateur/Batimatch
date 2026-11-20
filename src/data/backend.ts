import type { InvitationRow, AccessStatus, CommentRow, NotificationRow, SsoRequestInput, SsoRequestRow, SsoStatus, LotAccessRow, LotCatalogItem, LotPrivateRow, LotRow, LotStatus, MemberRow, OfferRow, ProfileRow, ProjectRow, ReviewRow } from './rows'
import type { Role, TechNote } from '../lib/types'

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
  /** Lots visibles par l'entreprise (publiés ou suspendus), avec l'état de sa demande d'accès */
  catalog: LotCatalogItem[]
  /** Demandes d'accès aux lots (acheteur : toutes ; entreprise : les siennes) */
  access: LotAccessRow[]
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
  /** Envoie un code de connexion par email. Avec `signup`, crée le compte s'il n'existe pas encore. */
  requestCode(email: string, signup?: Omit<SignUpInput, 'email' | 'password'>): Promise<void>
  verifyCode(email: string, code: string): Promise<void>
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
  /** Acheteur : copie complète d'un projet (lots en brouillon, offres comprises). Renvoie l'identifiant de la copie. */
  copyProject(id: string): Promise<string>
  /** Verrouille le projet. Le code n'est demandé qu'au premier verrouillage (erreur « lock_code_required » sinon). */
  lockProject(id: string, code?: string): Promise<void>
  unlockProject(id: string, code: string): Promise<'ok' | 'wrong' | 'blocked'>
  /** Code oublié : envoie par e-mail un code à usage unique */
  requestLockReset(id: string): Promise<void>
  resetLockCode(id: string, reset: string, code: string): Promise<'ok' | 'wrong' | 'expired' | 'blocked'>
  getProject(id: string): Promise<ProjectBundle>
  joinProject(code: string): Promise<string>
  removeMember(projectId: string, userId: string): Promise<void>
  /** Acheteur : ouvre son projet exemple, en le créant à partir du modèle s'il n'en a pas encore */
  openExampleProject(): Promise<string>
  // Lots
  createLot(input: Pick<LotRow, 'project_id' | 'name' | 'code' | 'due_date' | 'description' | 'items' | 'position'> & { id?: string; status?: LotStatus }): Promise<LotRow>
  updateLot(id: string, patch: Partial<Pick<LotRow, 'name' | 'code' | 'description' | 'due_date' | 'items' | 'position' | 'status'>>): Promise<void>
  deleteLot(id: string): Promise<void>
  upsertLotPrivate(row: LotPrivateRow): Promise<void>
  getLot(id: string): Promise<LotBundle>
  /** Entreprise : demander l'accès à un lot publié */
  requestLotAccess(lotId: string): Promise<void>
  /** Acheteur : accepter ou refuser une entreprise sur un lot */
  decideLotAccess(lotId: string, userId: string, status: Exclude<AccessStatus, 'pending' | 'declined'>): Promise<void>
  /** Entreprise : ne pas répondre à un lot accessible, avec un motif obligatoire */
  declineLot(lotId: string, comment: string): Promise<void>
  /** Entreprise : revenir sur un « ne pas répondre » */
  undeclineLot(lotId: string): Promise<void>
  /** Acheteur : relance par e-mail une entreprise acceptée qui n'a pas encore répondu. « example » : projet exemple, rien n'est envoyé. */
  remindCompany(lotId: string, userId: string): Promise<'sent' | 'example'>
  /** Acheteur : invite une adresse e-mail sur des lots du projet (e-mail avec le lien pour répondre) */
  inviteCompany(projectId: string, email: string, lotIds: string[]): Promise<'sent' | 'example'>
  /** Acheteur : invitations envoyées sur le projet */
  listInvitations(projectId: string): Promise<InvitationRow[]>
  /** Acheteur : date de la dernière relance par entreprise sur un lot */
  listLotReminders(lotId: string): Promise<{ user_id: string; last_at: string }[]>
  /** Alertes de la cloche, les plus récentes d'abord */
  listNotifications(): Promise<NotificationRow[]>
  markNotificationsRead(ids: string[]): Promise<void>
  // Connexion SSO des entreprises
  /** Demande d'activation du SSO, possible sans compte depuis la page de connexion */
  requestSso(input: SsoRequestInput): Promise<void>
  /** Administrateur : toutes les demandes avec leurs e-mails, les plus récentes d'abord */
  listSsoRequests(): Promise<SsoRequestRow[]>
  updateSsoRequest(id: string, patch: { status?: SsoStatus; admin_note?: string }): Promise<void>
  /** Administrateur : envoie un e-mail à l'entreprise et le garde dans l'historique de la demande */
  sendSsoReply(requestId: string, subject: string, body: string): Promise<void>
  deleteSsoRequest(id: string): Promise<void>
  // Offres
  upsertOffer(row: OfferRow): Promise<void>
  deleteOffer(id: string): Promise<void>
  /** Dépose la notice technique (PDF) d'une offre. `folder` = compte de l'entreprise, ou « manual » pour une offre saisie par l'acheteur. */
  uploadOfferFile(lotId: string, folder: string, offerId: string, file: File): Promise<TechNote>
  removeOfferFile(path: string): Promise<void>
  /** Lien temporaire pour ouvrir un fichier d'offre */
  offerFileUrl(path: string): Promise<string>
  // Évaluation interne
  upsertReview(row: ReviewRow): Promise<void>
  addComment(row: Omit<CommentRow, 'id' | 'created_at' | 'author_id'>): Promise<CommentRow>
  deleteComment(id: string): Promise<void>
}

/** Message d'erreur lisible pour l'utilisateur */
export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (/sso_busy/.test(raw)) return 'Trop de demandes en ce moment. Réessayez dans une heure ou écrivez à contact@paceapp.fr.'
  if (/sso_email/.test(raw)) return 'Cette adresse e-mail ne semble pas valide.'
  if (/sso_company|sso_contact/.test(raw)) return 'Indiquez le nom de l’entreprise et celui du contact.'
  if (/invite_email/.test(raw)) return 'Cette adresse e-mail n’est pas valide.'
  if (/invite_no_lot/.test(raw)) return 'Choisissez au moins un lot.'
  if (/invite_self/.test(raw)) return 'C’est votre propre adresse : invitez celle de l’entreprise.'
  if (/invite_limit/.test(raw)) return 'Trop d’invitations en une heure : réessayez un peu plus tard.'
  if (/invite_forbidden/.test(raw)) return 'Action réservée à l’acheteur du projet.'
  if (/project_locked/.test(raw)) return 'Ce projet est verrouillé : déverrouillez-le depuis la page du projet pour le modifier.'
  if (/lock_reset_recent/.test(raw)) return 'Un code vous a déjà été envoyé par e-mail il y a moins de 2 minutes : utilisez-le, ou réessayez dans un instant.'
  if (/lock_code_required/.test(raw)) return 'Choisissez un code d’au moins 4 caractères.'
  if (/lock_missing/.test(raw)) return 'Ce projet n’a pas encore de code de verrouillage.'
  if (/lock_forbidden|copy_forbidden/.test(raw)) return 'Action réservée à l’acheteur du projet.'
  if (/reminder_recent/.test(raw)) return 'Cette entreprise a déjà été relancée il y a moins de 24 heures.'
  if (/reminder_closed/.test(raw)) return 'Ce lot n’accepte plus d’offres (non publié, suspendu ou date de remise dépassée) : repoussez la date avant de relancer.'
  if (/reminder_answered/.test(raw)) return 'Cette entreprise a déjà envoyé son offre.'
  if (/reminder_no_access|reminder_forbidden/.test(raw)) return 'Relance impossible : l’entreprise n’est pas acceptée sur ce lot.'
  if (/example_buyer_only/.test(raw)) return 'Le projet exemple est réservé aux comptes acheteurs.'
  if (/example_missing/.test(raw)) return 'Le projet exemple n’est pas encore installé : exécutez supabase/example.sql dans l’éditeur SQL de Supabase.'
  if (/invite_company|project_invitations|copy_project|lock_project|unlock_project|locked_at|remind_company|lot_reminders|open_example_project|is_example|lot_access|notifications|sso_requests|sso_messages|request_sso|tech_note|offer-files|Bucket not found|project_lot_catalog|column .*status.* does not exist|schema cache/i.test(raw)) return 'La base de données doit être mise à jour : relancez supabase/schema.sql dans l’éditeur SQL de Supabase.'
  if (/signups not allowed/i.test(raw)) return 'Aucun compte avec cet email. Créez un compte.'
  if (/token has expired|otp_expired|invalid.*otp|otp.*invalid/i.test(raw)) return 'Code incorrect ou expiré. Vérifiez-le ou demandez-en un nouveau.'
  if (/security purposes/i.test(raw)) return 'Patientez une minute avant de redemander un code.'
  if (/invalid login credentials/i.test(raw)) return 'Email ou mot de passe incorrect.'
  if (/email not confirmed/i.test(raw)) return 'Confirmez d’abord votre adresse : un lien vous a été envoyé par email.'
  if (/user already registered/i.test(raw)) return 'Un compte existe déjà avec cet email. Connectez-vous.'
  if (/password should be at least/i.test(raw)) return 'Le mot de passe doit contenir au moins 6 caractères.'
  if (/rate limit/i.test(raw)) return 'Trop de tentatives. Réessayez dans quelques minutes.'
  if (/row-level security|violates row-level/i.test(raw)) return 'Action refusée : la date de rendu est peut-être dépassée, ou vous n’avez pas les droits.'
  if (/failed to fetch|network/i.test(raw)) return 'Connexion impossible. Vérifiez votre réseau.'
  return raw
}
