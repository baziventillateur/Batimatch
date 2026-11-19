import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Backend, OfferLite, ProjectBundle, ProjectListItem } from './backend'
import type { NotificationRow, SsoRequestRow, CommentRow, LotAccessRow, LotCatalogItem, LotPrivateRow, LotRow, MemberRow, OfferRow, ProfileRow, ProjectRow, ReviewRow } from './rows'

// Adresse et clé publique du projet Supabase. La clé « publishable » est faite pour être
// embarquée dans l'application : la sécurité repose sur les règles RLS de la base.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://uhdanxctslncwwmcziba.supabase.co'
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_KEY as string | undefined) ?? 'sb_publishable_JgAIiSsQzux9khoze9Pi1A_tHxfrPMY'

const OFFER_LITE = 'id, lot_id, company_id, source, status, company_name, logo_url, submitted_at, updated_at, version, prices, discount_pct'

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

export function createSupabaseBackend(): Backend {
  const sb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  const redirectTo = () => window.location.origin + window.location.pathname

  return {
    kind: 'supabase',

    async getUserId() {
      const { data } = await sb.auth.getSession()
      return data.session?.user.id ?? null
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session?.user.id ?? null))
      return () => data.subscription.unsubscribe()
    },
    async signUp(i) {
      const { data, error } = await sb.auth.signUp({
        email: i.email,
        password: i.password,
        options: {
          emailRedirectTo: redirectTo(),
          data: { role: i.role, first_name: i.firstName, last_name: i.lastName, company_name: i.companyName, phone: i.phone },
        },
      })
      if (error) throw error
      return { needsConfirmation: !data.session }
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async requestCode(email, signup) {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: !!signup,
          data: signup && { role: signup.role, first_name: signup.firstName, last_name: signup.lastName, company_name: signup.companyName, phone: signup.phone },
        },
      })
      if (error) throw error
    },
    async verifyCode(email, code) {
      const { error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' })
      if (error) throw error
    },
    async signOut() {
      await sb.auth.signOut()
    },
    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() })
      if (error) throw error
    },

    onPasswordRecovery(cb) {
      const { data } = sb.auth.onAuthStateChange((event) => event === 'PASSWORD_RECOVERY' && cb())
      return () => data.subscription.unsubscribe()
    },
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password })
      if (error) throw error
    },

    async getProfile(id) {
      return check(await sb.from('profiles').select('*').eq('id', id).maybeSingle()) as ProfileRow | null
    },
    async updateProfile(id, patch) {
      // upsert : crée le profil s'il manque (compte créé avant l'installation du schéma)
      return check(await sb.from('profiles').upsert({ id, ...patch }, { onConflict: 'id' }).select('*').single()) as ProfileRow
    },
    async uploadImage(userId, path, file) {
      const full = `${userId}/${path}`
      const { error } = await sb.storage.from('logos').upload(full, file, { upsert: true, contentType: file.type || 'image/webp', cacheControl: '3600' })
      if (error) throw error
      const { data } = sb.storage.from('logos').getPublicUrl(full)
      return `${data.publicUrl}?v=${Date.now()}`
    },

    async listProjects() {
      const projects = check(await sb.from('projects').select('*').order('created_at', { ascending: false })) as ProjectRow[]
      if (!projects.length) return []
      const ids = projects.map((p) => p.id)
      const lots = check(await sb.from('lots').select('id, project_id, name, code, due_date').in('project_id', ids).order('position')) as (Pick<LotRow, 'id' | 'name' | 'code' | 'due_date'> & { project_id: string })[]
      const lotIds = lots.map((l) => l.id)
      const offers = lotIds.length
        ? (check(await sb.from('offers').select('id, lot_id, status, company_id').in('lot_id', lotIds)) as ProjectListItem['offers'])
        : []
      return projects.map((project) => {
        const pl = lots.filter((l) => l.project_id === project.id)
        const set = new Set(pl.map((l) => l.id))
        return { project, lots: pl, offers: offers.filter((o) => set.has(o.lot_id)) }
      })
    },
    async createProject(input) {
      return check(await sb.from('projects').insert(input).select('*').single()) as ProjectRow
    },
    async updateProject(id, patch) {
      check(await sb.from('projects').update(patch).eq('id', id))
    },
    async deleteProject(id) {
      check(await sb.from('projects').delete().eq('id', id))
    },
    async getProject(id): Promise<ProjectBundle> {
      const project = check(await sb.from('projects').select('*').eq('id', id).single()) as ProjectRow
      const [lots, owner, members] = await Promise.all([
        sb.from('lots').select('*').eq('project_id', id).order('position').order('created_at'),
        sb.from('profiles').select('*').eq('id', project.owner_id).maybeSingle(),
        sb.from('project_members').select('*').eq('project_id', id).order('joined_at'),
      ])
      const lotRows = check(lots) as LotRow[]
      const memberRows = check(members) as MemberRow[]
      const lotIds = lotRows.map((l) => l.id)
      // Les accès de l'entreprise à un lot qu'elle a décliné ne sont pas dans « lots » : on les charge aussi par utilisateur
      const { data: who } = await sb.auth.getUser()
      const myId = who.user?.id ?? '00000000-0000-0000-0000-000000000000'
      const accessFilter = lotIds.length ? `lot_id.in.(${lotIds.join(',')}),user_id.eq.${myId}` : `user_id.eq.${myId}`
      const [privates, access, catalog, offers, profiles] = await Promise.all([
        lotIds.length ? sb.from('lot_private').select('*').in('lot_id', lotIds) : Promise.resolve({ data: [], error: null }),
        sb.from('lot_access').select('*').or(accessFilter),
        sb.rpc('project_lot_catalog', { p_project: id }),
        lotIds.length ? sb.from('offers').select(OFFER_LITE).in('lot_id', lotIds) : Promise.resolve({ data: [], error: null }),
        memberRows.length ? sb.from('profiles').select('*').in('id', memberRows.map((m) => m.user_id)) : Promise.resolve({ data: [], error: null }),
      ])
      const profRows = (check(profiles) ?? []) as ProfileRow[]
      return {
        project,
        owner: (owner.data as ProfileRow | null) ?? null,
        lots: lotRows,
        privates: (check(privates) ?? []) as LotPrivateRow[],
        // Base pas encore mise à jour : on retombe sur l'ancien fonctionnement (tous les lots ouverts)
        catalog: catalog.error
          ? lotRows.map((l) => ({ id: l.id, name: l.name, code: l.code, due_date: l.due_date, status: 'published' as const, line_count: (l.items ?? []).filter((i) => i.kind === 'line').length, access: 'approved' as const }))
          : ((catalog.data ?? []) as LotCatalogItem[]),
        access: access.error ? [] : ((access.data ?? []) as LotAccessRow[]),
        offers: (check(offers) ?? []) as OfferLite[],
        members: memberRows.map((m) => ({ ...m, profile: profRows.find((p) => p.id === m.user_id) ?? null })),
      }
    },
    async joinProject(code) {
      return check(await sb.rpc('join_project', { p_code: code })) as string
    },
    async removeMember(projectId, userId) {
      check(await sb.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId))
    },
    async copyProject(id) {
      return check(await sb.rpc('copy_project', { p_project: id })) as string
    },
    async lockProject(id, code) {
      check(await sb.rpc('lock_project', { p_project: id, p_code: code ?? null }))
    },
    async unlockProject(id, code) {
      return check(await sb.rpc('unlock_project', { p_project: id, p_code: code })) as 'ok' | 'wrong' | 'blocked'
    },
    async requestLockReset(id) {
      check(await sb.rpc('request_lock_reset', { p_project: id }))
    },
    async resetLockCode(id, reset, code) {
      return check(await sb.rpc('reset_lock_code', { p_project: id, p_reset: reset, p_code: code })) as 'ok' | 'wrong' | 'expired' | 'blocked'
    },
    async openExampleProject() {
      return check(await sb.rpc('open_example_project')) as string
    },

    async createLot(input) {
      return check(await sb.from('lots').insert(input).select('*').single()) as LotRow
    },
    async updateLot(id, patch) {
      check(await sb.from('lots').update(patch).eq('id', id))
    },
    async deleteLot(id) {
      check(await sb.from('lots').delete().eq('id', id))
    },
    async upsertLotPrivate(row) {
      check(await sb.from('lot_private').upsert(row, { onConflict: 'lot_id' }))
    },
    async requestLotAccess(lotId) {
      const { data } = await sb.auth.getUser()
      check(await sb.from('lot_access').insert({ lot_id: lotId, user_id: data.user?.id }))
    },
    async decideLotAccess(lotId, userId, status) {
      check(await sb.from('lot_access').update({ status, decided_at: new Date().toISOString(), comment: null }).eq('lot_id', lotId).eq('user_id', userId))
    },
    async declineLot(lotId, comment) {
      const { data } = await sb.auth.getUser()
      check(await sb.from('lot_access').update({ status: 'declined', comment: comment.trim(), decided_at: new Date().toISOString() }).eq('lot_id', lotId).eq('user_id', data.user?.id ?? ''))
    },
    async undeclineLot(lotId) {
      const { data } = await sb.auth.getUser()
      check(await sb.from('lot_access').update({ status: 'approved', comment: null, decided_at: new Date().toISOString() }).eq('lot_id', lotId).eq('user_id', data.user?.id ?? ''))
    },
    async remindCompany(lotId, userId) {
      return check(await sb.rpc('remind_company', { p_lot: lotId, p_user: userId })) as 'sent' | 'example'
    },
    async listLotReminders(lotId) {
      const res = await sb.rpc('lot_reminders', { p_lot: lotId })
      return res.error ? [] : ((res.data ?? []) as { user_id: string; last_at: string }[])
    },
    async listNotifications() {
      return check(await sb.from('notifications').select('id, user_id, kind, project_id, lot_id, actor_id, data, read_at, created_at').order('created_at', { ascending: false }).limit(30)) as NotificationRow[]
    },
    async markNotificationsRead(ids) {
      if (ids.length) check(await sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids))
    },
    async requestSso(i) {
      check(await sb.rpc('request_sso', { p_company: i.company, p_contact: i.contact, p_email: i.email, p_phone: i.phone, p_users: i.users, p_provider: i.provider, p_message: i.message }))
    },
    async listSsoRequests() {
      const rows = check(await sb.from('sso_requests').select('*, messages:sso_messages(*)').order('created_at', { ascending: false })) as SsoRequestRow[]
      return rows.map((r) => ({ ...r, messages: [...(r.messages ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)) }))
    },
    async updateSsoRequest(id, patch) {
      check(await sb.from('sso_requests').update(patch).eq('id', id))
    },
    async sendSsoReply(requestId, subject, body) {
      check(await sb.from('sso_messages').insert({ request_id: requestId, kind: 'reply', subject: subject.trim(), body: body.trim() }))
    },
    async deleteSsoRequest(id) {
      check(await sb.from('sso_requests').delete().eq('id', id))
    },
    async getLot(id) {
      const lot = check(await sb.from('lots').select('*').eq('id', id).single()) as LotRow
      const [project, priv, offers, reviews, comments] = await Promise.all([
        sb.from('projects').select('*').eq('id', lot.project_id).single(),
        sb.from('lot_private').select('*').eq('lot_id', id).maybeSingle(),
        sb.from('offers').select('*').eq('lot_id', id).order('created_at'),
        sb.from('offer_reviews').select('*').eq('lot_id', id),
        sb.from('offer_comments').select('*').eq('lot_id', id).order('created_at'),
      ])
      return {
        project: check(project) as ProjectRow,
        lot,
        priv: (priv.data as LotPrivateRow | null) ?? null,
        offers: check(offers) as OfferRow[],
        reviews: (reviews.data ?? []) as ReviewRow[],
        comments: (comments.data ?? []) as CommentRow[],
      }
    },

    async upsertOffer(row) {
      const { updated_at: _ignored, ...clean } = row
      void _ignored
      check(await sb.from('offers').upsert(clean, { onConflict: 'id' }))
    },
    async deleteOffer(id) {
      check(await sb.from('offers').delete().eq('id', id))
    },
    async uploadOfferFile(lotId, folder, offerId, file) {
      const path = `${lotId}/${folder}/${offerId}.pdf`
      const { error } = await sb.storage.from('offer-files').upload(path, file, { upsert: true, contentType: 'application/pdf', cacheControl: '0' })
      if (error) throw error
      return { path, name: file.name, size: file.size, at: new Date().toISOString() }
    },
    async removeOfferFile(path) {
      const { error } = await sb.storage.from('offer-files').remove([path])
      if (error) throw error
    },
    async offerFileUrl(path) {
      const { data, error } = await sb.storage.from('offer-files').createSignedUrl(path, 300)
      if (error || !data) throw error ?? new Error('Fichier introuvable.')
      return data.signedUrl
    },
    async upsertReview(row) {
      check(await sb.from('offer_reviews').upsert(row, { onConflict: 'offer_id' }))
    },
    async addComment(row) {
      const { data: s } = await sb.auth.getSession()
      return check(await sb.from('offer_comments').insert({ ...row, author_id: s.session?.user.id }).select('*').single()) as CommentRow
    },
    async deleteComment(id) {
      check(await sb.from('offer_comments').delete().eq('id', id))
    },
  }
}
