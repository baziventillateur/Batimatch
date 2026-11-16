// Backend de démonstration en mémoire (stocké dans le navigateur), qui reproduit
// les règles d'accès de la base Supabase. Sert au développement et aux tests visuels.
import type { SignUpInput, Backend, OfferLite } from './backend'
import type { NotificationRow, SsoRequestRow, CommentRow, LotAccessRow, LotCatalogItem, LotPrivateRow, LotRow, MemberRow, OfferRow, ProfileRow, ProjectRow, ReviewRow } from './rows'
import { uid } from '../lib/id'

const files = new Map<string, Blob>()
/** En démo aucun email ne part : le code de connexion est toujours le même */
export const DEMO_CODE = '123456'
const pendingSignups = new Map<string, Omit<SignUpInput, 'email' | 'password'>>()

interface Db {
  users: { id: string; email: string; password: string }[]
  profiles: ProfileRow[]
  projects: ProjectRow[]
  members: MemberRow[]
  lots: LotRow[]
  privates: LotPrivateRow[]
  access: LotAccessRow[]
  offers: OfferRow[]
  reviews: ReviewRow[]
  comments: CommentRow[]
  notifications: NotificationRow[]
  sso: SsoRequestRow[]
  session: string | null
}

const KEY = 'batimatch:mock'
const empty = (): Db => ({ users: [], profiles: [], projects: [], members: [], lots: [], privates: [], access: [], offers: [], reviews: [], comments: [], notifications: [], sso: [], session: null })

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty()
  } catch {
    return empty()
  }
}

export function createMockBackend(): Backend {
  let db = load()
  const listeners = new Set<(id: string | null) => void>()
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db))
    } catch {
      /* stockage indisponible : on reste en mémoire */
    }
  }
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
  /** Même rôle que le déclencheur de la base : une alerte quand une demande d'accès évolue */
  const notify = (kind: NotificationRow['kind'], lotId: string, companyId: string, toOwner: boolean, comment?: string) => {
    const l = db.lots.find((x) => x.id === lotId)
    const p = db.projects.find((x) => x.id === l?.project_id)
    const c = db.profiles.find((x) => x.id === companyId)
    if (!l || !p) return
    db.notifications.push({
      id: uid(),
      user_id: toOwner ? p.owner_id : companyId,
      kind,
      project_id: p.id,
      lot_id: l.id,
      actor_id: toOwner ? companyId : p.owner_id,
      data: { project: p.name, lot: l.name, company: c?.company_name || [c?.first_name, c?.last_name].filter(Boolean).join(' '), contact: [c?.first_name, c?.last_name].filter(Boolean).join(' '), comment },
      read_at: null,
      created_at: new Date().toISOString(),
    })
  }
  const now = () => new Date().toISOString()
  const today = () => new Date().toISOString().slice(0, 10)
  const me = () => {
    if (!db.session) throw new Error('Session expirée : reconnectez-vous.')
    return db.session
  }
  const isOwner = (pid: string) => db.projects.some((p) => p.id === pid && p.owner_id === db.session)
  const isMember = (pid: string) => db.members.some((m) => m.project_id === pid && m.user_id === db.session)
  const lotProject = (lid: string) => db.lots.find((l) => l.id === lid)?.project_id ?? ''
  const lotOpen = (lid: string) => {
    const l = db.lots.find((x) => x.id === lid)
    return !!l && (l.status ?? 'published') === 'published' && (!l.due_date || l.due_date >= today())
  }
  /** Entreprise acceptée sur un lot visible */
  const hasAccess = (lid: string) => {
    const l = db.lots.find((x) => x.id === lid)
    return !!l && (l.status ?? 'published') !== 'draft' && isMember(l.project_id) && db.access.some((a) => a.lot_id === lid && a.user_id === db.session && a.status === 'approved')
  }
  const canSeeOffer = (o: OfferRow) => o.company_id === db.session || (isOwner(lotProject(o.lot_id)) && (o.status === 'submitted' || o.source === 'manual'))
  const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60))
  const deny = () => {
    throw new Error('new row violates row-level security policy')
  }
  const code = () => {
    const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    let c = ''
    do {
      c = Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join('')
    } while (db.projects.some((p) => p.access_code === c))
    return c
  }

  return {
    kind: 'mock',

    async getUserId() {
      return db.session
    },
    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async signUp(i) {
      if (db.users.some((u) => u.email.toLowerCase() === i.email.toLowerCase())) throw new Error('User already registered')
      if (i.password.length < 6) throw new Error('Password should be at least 6 characters')
      const id = uid()
      db.users.push({ id, email: i.email, password: i.password })
      db.profiles.push({ id, role: i.role, email: i.email, first_name: i.firstName, last_name: i.lastName, company_name: i.companyName, phone: i.phone, logo_url: null })
      db.session = id
      save()
      listeners.forEach((l) => l(id))
      return delay({ needsConfirmation: false })
    },
    async signIn(email, password) {
      const u = db.users.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password)
      if (!u) throw new Error('Invalid login credentials')
      db.session = u.id
      save()
      listeners.forEach((l) => l(u.id))
      await delay(null)
    },
    async requestCode(email, signup) {
      const known = db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())
      if (!known && !signup) throw new Error('Signups not allowed for otp')
      if (!known && signup) pendingSignups.set(email.toLowerCase(), signup)
      await delay(null)
    },
    async verifyCode(email, code) {
      if (code !== DEMO_CODE) throw new Error('Token has expired or is invalid')
      let u = db.users.find((x) => x.email.toLowerCase() === email.toLowerCase())
      if (!u) {
        const i = pendingSignups.get(email.toLowerCase())
        if (!i) throw new Error('Token has expired or is invalid')
        u = { id: uid(), email, password: '' }
        db.users.push(u)
        db.profiles.push({ id: u.id, role: i.role, email, first_name: i.firstName, last_name: i.lastName, company_name: i.companyName, phone: i.phone, logo_url: null })
        pendingSignups.delete(email.toLowerCase())
      }
      const id = u.id
      db.session = id
      save()
      listeners.forEach((l) => l(id))
      await delay(null)
    },
    async signOut() {
      db.session = null
      save()
      listeners.forEach((l) => l(null))
    },
    async resetPassword() {
      await delay(null)
    },

    onPasswordRecovery() {
      return () => {}
    },
    async updatePassword() {
      await delay(null)
    },

    async getProfile(id) {
      const p = db.profiles.find((x) => x.id === id)
      if (!p) return null
      const visible =
        id === db.session ||
        db.members.some((m) => m.user_id === id && isOwner(m.project_id)) ||
        db.projects.some((pr) => pr.owner_id === id && isMember(pr.id))
      return delay(visible ? clone(p) : null)
    },
    async updateProfile(id, patch) {
      if (id !== me()) deny()
      let p = db.profiles.find((x) => x.id === id)
      if (!p) {
        p = { id, role: 'company', email: db.users.find((u) => u.id === id)?.email ?? '', first_name: '', last_name: '', company_name: '', phone: '', logo_url: null }
        db.profiles.push(p)
      }
      Object.assign(p, patch)
      save()
      return delay(clone(p))
    },
    async uploadImage(_userId, _path, file) {
      // En démonstration, l'image est conservée en data URL
      return new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(r.error)
        r.readAsDataURL(file)
      })
    },

    async listProjects() {
      const uidMe = me()
      const projects = db.projects.filter((p) => p.owner_id === uidMe || isMember(p.id)).sort((a, b) => b.created_at.localeCompare(a.created_at))
      return delay(
        projects.map((project) => {
          const lots = db.lots.filter((l) => l.project_id === project.id).sort((a, b) => a.position - b.position)
          const ids = new Set(lots.map((l) => l.id))
          return {
            project: clone(project),
            lots: lots.filter((l) => isOwner(project.id) || hasAccess(l.id)).map(({ id, name, code, due_date }) => ({ id, name, code, due_date })),
            offers: db.offers.filter((o) => ids.has(o.lot_id) && canSeeOffer(o)).map(({ id, lot_id, status, company_id }) => ({ id, lot_id, status, company_id })),
          }
        }),
      )
    },
    async createProject(input) {
      const row: ProjectRow = { id: uid(), owner_id: me(), access_code: code(), created_at: now(), ...input }
      db.projects.push(row)
      save()
      return delay(clone(row))
    },
    async updateProject(id, patch) {
      if (!isOwner(id)) deny()
      Object.assign(db.projects.find((p) => p.id === id)!, patch)
      save()
    },
    async deleteProject(id) {
      if (!isOwner(id)) deny()
      const lots = new Set(db.lots.filter((l) => l.project_id === id).map((l) => l.id))
      db.projects = db.projects.filter((p) => p.id !== id)
      db.members = db.members.filter((m) => m.project_id !== id)
      db.lots = db.lots.filter((l) => !lots.has(l.id))
      db.privates = db.privates.filter((p) => !lots.has(p.lot_id))
      db.offers = db.offers.filter((o) => !lots.has(o.lot_id))
      db.reviews = db.reviews.filter((r) => !lots.has(r.lot_id))
      db.comments = db.comments.filter((c) => !lots.has(c.lot_id))
      save()
    },
    async getProject(id) {
      const project = db.projects.find((p) => p.id === id)
      if (!project || !(isOwner(id) || isMember(id))) throw new Error('Projet introuvable.')
      const owner = isOwner(id)
      const all = db.lots.filter((l) => l.project_id === id).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
      const lots = owner ? all : all.filter((l) => hasAccess(l.id))
      const ids = new Set(all.map((l) => l.id))
      const catalog: LotCatalogItem[] = owner
        ? []
        : all
            .filter((l) => (l.status ?? 'published') !== 'draft')
            .map((l) => ({
              id: l.id, name: l.name, code: l.code, due_date: l.due_date, status: l.status ?? 'published',
              line_count: (l.items ?? []).filter((i) => i.kind === 'line').length,
              access: db.access.find((a) => a.lot_id === l.id && a.user_id === db.session)?.status ?? null,
            }))
      const members = db.members.filter((m) => m.project_id === id && (owner || m.user_id === db.session))
      return delay(
        clone({
          project,
          owner: db.profiles.find((p) => p.id === project.owner_id) ?? null,
          lots,
          privates: owner ? db.privates.filter((p) => ids.has(p.lot_id)) : [],
          catalog,
          access: db.access.filter((a) => ids.has(a.lot_id) && (owner || a.user_id === db.session)),
          offers: db.offers
            .filter((o) => ids.has(o.lot_id) && canSeeOffer(o))
            .map((o): OfferLite => ({
              id: o.id, lot_id: o.lot_id, company_id: o.company_id, source: o.source, status: o.status, company_name: o.company_name,
              logo_url: o.logo_url, submitted_at: o.submitted_at, updated_at: o.updated_at, version: o.version, prices: o.prices, discount_pct: o.discount_pct,
            })),
          members: members.map((m) => ({ ...m, profile: db.profiles.find((p) => p.id === m.user_id) ?? null })),
        }),
      )
    },
    async joinProject(c) {
      const uidMe = me()
      const p = db.projects.find((x) => x.access_code === c.trim().toUpperCase().replace(/\s/g, ''))
      if (!p) throw new Error('Code inconnu : vérifiez le code transmis par l’acheteur.')
      if (p.owner_id !== uidMe && !isMember(p.id)) db.members.push({ project_id: p.id, user_id: uidMe, joined_at: now() })
      save()
      return delay(p.id)
    },
    async removeMember(projectId, userId) {
      if (!(isOwner(projectId) || userId === db.session)) deny()
      db.members = db.members.filter((m) => !(m.project_id === projectId && m.user_id === userId))
      save()
    },

    async createLot(input) {
      if (!isOwner(input.project_id)) deny()
      const row: LotRow = { id: input.id ?? uid(), created_at: now(), updated_at: now(), status: 'draft', ...input }
      db.lots.push(row)
      save()
      return delay(clone(row))
    },
    async updateLot(id, patch) {
      if (!isOwner(lotProject(id))) deny()
      Object.assign(db.lots.find((l) => l.id === id)!, patch, { updated_at: now() })
      save()
    },
    async deleteLot(id) {
      if (!isOwner(lotProject(id))) deny()
      db.lots = db.lots.filter((l) => l.id !== id)
      db.privates = db.privates.filter((p) => p.lot_id !== id)
      db.access = db.access.filter((a) => a.lot_id !== id)
      db.offers = db.offers.filter((o) => o.lot_id !== id)
      db.reviews = db.reviews.filter((r) => r.lot_id !== id)
      db.comments = db.comments.filter((c) => c.lot_id !== id)
      save()
    },
    async upsertLotPrivate(row) {
      if (!isOwner(lotProject(row.lot_id))) deny()
      db.privates = [...db.privates.filter((p) => p.lot_id !== row.lot_id), clone(row)]
      save()
    },
    async requestLotAccess(lotId) {
      const uidMe = me()
      const l = db.lots.find((x) => x.id === lotId)
      if (!l || (l.status ?? 'published') !== 'published' || !isMember(l.project_id)) deny()
      if (db.access.some((a) => a.lot_id === lotId && a.user_id === uidMe)) throw new Error('duplicate key value violates unique constraint "lot_access_pkey"')
      db.access.push({ lot_id: lotId, user_id: uidMe, status: 'pending', requested_at: now(), decided_at: null })
      notify('access_requested', lotId, uidMe, true)
      save()
      await delay(null)
    },
    async decideLotAccess(lotId, userId, status) {
      if (!isOwner(lotProject(lotId))) deny()
      const a = db.access.find((x) => x.lot_id === lotId && x.user_id === userId)
      if (a && a.status !== status) {
        if (a.status === 'pending') for (const n of db.notifications) if (n.kind === 'access_requested' && n.lot_id === lotId && n.actor_id === userId && !n.read_at) n.read_at = now()
        notify(status === 'approved' ? 'access_approved' : 'access_refused', lotId, userId, false)
      }
      if (a) Object.assign(a, { status, decided_at: now(), comment: null })
      save()
      await delay(null)
    },
    async declineLot(lotId, comment) {
      const a = db.access.find((x) => x.lot_id === lotId && x.user_id === me())
      if (!a || (a.status !== 'approved' && a.status !== 'declined') || !lotOpen(lotId)) throw new Error('Action non autorisée sur ce lot.')
      if (comment.trim().length < 3) throw new Error('Le motif doit comporter au moins 3 caractères.')
      if (a.status !== 'declined') notify('lot_declined', lotId, a.user_id, true, comment.trim())
      Object.assign(a, { status: 'declined', comment: comment.trim(), decided_at: now() })
      save()
      await delay(null)
    },
    async undeclineLot(lotId) {
      const a = db.access.find((x) => x.lot_id === lotId && x.user_id === me())
      if (!a || a.status !== 'declined' || !lotOpen(lotId)) throw new Error('Action non autorisée sur ce lot.')
      Object.assign(a, { status: 'approved', comment: null, decided_at: now() })
      save()
      await delay(null)
    },
    async listNotifications() {
      const mine = db.notifications.filter((n) => n.user_id === db.session)
      return delay(clone(mine).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30))
    },
    async markNotificationsRead(ids) {
      for (const n of db.notifications) if (ids.includes(n.id) && n.user_id === db.session && !n.read_at) n.read_at = now()
      save()
    },
    // SSO : en démo, les demandes restent dans le navigateur et aucun e-mail ne part
    async requestSso(i) {
      const email = i.email.trim().toLowerCase()
      if (db.sso.some((r) => r.email === email)) return delay(undefined)
      const id = uid()
      db.sso.push({
        id,
        company_name: i.company.trim(),
        contact_name: i.contact.trim(),
        email,
        phone: i.phone.trim(),
        user_count: i.users,
        provider: i.provider,
        message: i.message.trim(),
        status: 'new',
        admin_note: '',
        created_at: now(),
        updated_at: now(),
        messages: [{ id: uid(), request_id: id, kind: 'ack', subject: '', body: '', emailed_at: now(), created_at: now() }],
      })
      save()
      await delay(null)
    },
    async listSsoRequests() {
      return delay(clone(db.sso).sort((a, b) => b.created_at.localeCompare(a.created_at)))
    },
    async updateSsoRequest(id, patch) {
      const r = db.sso.find((x) => x.id === id)
      if (r) Object.assign(r, patch, { updated_at: now() })
      save()
      await delay(null)
    },
    async sendSsoReply(requestId, subject, body) {
      const r = db.sso.find((x) => x.id === requestId)
      if (!r) throw new Error('Demande introuvable.')
      r.messages.push({ id: uid(), request_id: requestId, kind: 'reply', subject: subject.trim(), body: body.trim(), emailed_at: now(), created_at: now() })
      if (r.status === 'new') r.status = 'contacted'
      save()
      await delay(null)
    },
    async deleteSsoRequest(id) {
      db.sso = db.sso.filter((x) => x.id !== id)
      save()
      await delay(null)
    },
    async getLot(id) {
      const lot = db.lots.find((l) => l.id === id)
      if (!lot) throw new Error('Lot introuvable.')
      const pid = lot.project_id
      const owner = isOwner(pid)
      if (!owner && !hasAccess(id)) throw new Error('Lot introuvable.')
      return delay(
        clone({
          project: db.projects.find((p) => p.id === pid)!,
          lot,
          priv: owner ? (db.privates.find((p) => p.lot_id === id) ?? null) : null,
          offers: db.offers.filter((o) => o.lot_id === id && canSeeOffer(o)),
          reviews: owner ? db.reviews.filter((r) => r.lot_id === id) : [],
          comments: owner ? db.comments.filter((c) => c.lot_id === id) : [],
        }),
      )
    },

    async upsertOffer(row) {
      const uidMe = me()
      const existing = db.offers.find((o) => o.id === row.id)
      const pid = lotProject(row.lot_id)
      const ok =
        (row.source === 'platform' && row.company_id === uidMe && hasAccess(row.lot_id) && lotOpen(row.lot_id)) ||
        (row.source === 'manual' && row.company_id === null && isOwner(pid))
      if (!ok) deny()
      if (existing) {
        const canUpdate = (existing.source === 'platform' && existing.company_id === uidMe && lotOpen(existing.lot_id)) || (existing.source === 'manual' && isOwner(pid))
        if (!canUpdate) deny()
        Object.assign(existing, clone(row), { updated_at: now() })
      } else {
        if (row.source === 'platform' && db.offers.some((o) => o.source === 'platform' && o.lot_id === row.lot_id && o.company_id === uidMe)) {
          throw new Error('duplicate key value violates unique constraint "offers_one_per_company"')
        }
        db.offers.push({ ...clone(row), updated_at: now() })
      }
      save()
      await delay(null)
    },
    async uploadOfferFile(lotId, folder, offerId, file) {
      const mine = folder === me() && hasAccess(lotId) && lotOpen(lotId)
      if (!mine && !(folder === 'manual' && isOwner(lotProject(lotId)))) deny()
      if (file.type !== 'application/pdf') throw new Error('mime type not supported')
      const path = `${lotId}/${folder}/${offerId}.pdf`
      // En démonstration, le fichier reste en mémoire : il disparaît au rechargement de la page
      files.set(path, file)
      await delay(null)
      return { path, name: file.name, size: file.size, at: now() }
    },
    async removeOfferFile(path) {
      files.delete(path)
    },
    async offerFileUrl(path) {
      const f = files.get(path)
      if (!f) throw new Error('En démonstration, le fichier n’est conservé que jusqu’au rechargement de la page.')
      return URL.createObjectURL(f)
    },
    async deleteOffer(id) {
      const o = db.offers.find((x) => x.id === id)
      if (!o) return
      const ok = (o.source === 'manual' && isOwner(lotProject(o.lot_id))) || (o.company_id === db.session && o.status === 'draft')
      if (!ok) deny()
      db.offers = db.offers.filter((x) => x.id !== id)
      db.reviews = db.reviews.filter((r) => r.offer_id !== id)
      db.comments = db.comments.filter((c) => c.offer_id !== id)
      save()
    },
    async upsertReview(row) {
      if (!isOwner(lotProject(row.lot_id))) deny()
      db.reviews = [...db.reviews.filter((r) => r.offer_id !== row.offer_id), clone(row)]
      save()
    },
    async addComment(row) {
      if (!isOwner(lotProject(row.lot_id))) deny()
      const c: CommentRow = { ...row, id: uid(), author_id: db.session, created_at: now() }
      db.comments.push(c)
      save()
      return delay(clone(c))
    },
    async deleteComment(id) {
      const c = db.comments.find((x) => x.id === id)
      if (c && !isOwner(lotProject(c.lot_id))) deny()
      db.comments = db.comments.filter((x) => x.id !== id)
      save()
    },
  }
}
