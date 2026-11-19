// Test des règles d'accès du schéma sur un Postgres local (PGlite) qui simule Supabase.
// Lancer : node supabase/test/rls.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const db = new PGlite()
const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
const example = readFileSync(new URL('../example.sql', import.meta.url), 'utf8')

// — Simulation minimale de Supabase : rôles, auth.users, auth.uid(), stockage —
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz default now(),
    instance_id uuid, aud text, role text, encrypted_password text, raw_app_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
    banned_until timestamptz, confirmation_token text, recovery_token text, email_change_token_new text, email_change text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to authenticated, anon;
  grant select, insert, update, delete on storage.objects to authenticated;
`)

await db.exec(schema)
await db.exec(schema) // le script doit pouvoir être relancé
console.log('✓ schéma appliqué deux fois sans erreur')

const B = '11111111-1111-1111-1111-111111111111'
const C1 = '22222222-2222-2222-2222-222222222222'
const C2 = '33333333-3333-3333-3333-333333333333'
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
  ('${B}', 'acheteur@test.fr', '{"role":"buyer","first_name":"Émir","last_name":"K","company_name":"Léon Grosse"}'),
  ('${C1}', 'c1@test.fr', '{"role":"company","company_name":"TP Val-de-Seine","phone":"0102030405"}'),
  ('${C2}', 'c2@test.fr', '{"role":"company","company_name":"Bitumes & Bordures"}');
`)
const roles = await db.query(`select id, role, company_name from public.profiles order by email`)
assert.equal(roles.rows.length, 3)
assert.equal(roles.rows.find((r) => r.id === B).role, 'buyer')
console.log('✓ profils créés à l’inscription')

// Exécute une requête en tant qu'utilisateur connecté
async function as(user, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role authenticated;`)
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec('reset role')
  }
}
async function fails(user, sql, label) {
  let ok = false
  try {
    await as(user, sql)
  } catch {
    ok = true
  }
  assert.ok(ok, `devrait échouer : ${label}`)
}

// Acheteur : projet, lot, données privées
const p = await as(B, `insert into public.projects (name, reference) values ('Résidence des Tilleuls', '24-017') returning id, access_code`)
const { id: pid, access_code: code } = p.rows[0]
assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/)
const lot = await as(B, `insert into public.lots (project_id, name, due_date, items) values ($1, 'Lot VRD', current_date + 7, '[{"id":"a","kind":"line"}]') returning id`, [pid])
const lid = lot.rows[0].id
await as(B, `insert into public.lot_private (lot_id, budget, budget_prices) values ($1, 375000, '{"a": 12.5}')`, [lid])
console.log('✓ acheteur : projet (code ' + code + '), lot et budget')

// Entreprise : rien avant d'avoir rejoint
assert.equal((await as(C1, `select * from public.projects`)).rows.length, 0)
assert.equal((await as(C1, `select * from public.lots`)).rows.length, 0)
await fails(C1, `insert into public.offers (lot_id, company_id) values ('${lid}', '${C1}')`, 'offre sans avoir rejoint')
await fails(C1, `select public.join_project('ZZZZZZ')`, 'code inconnu')
const joined = await as(C1, `select public.join_project($1) as pid`, [code.toLowerCase()])
assert.equal(joined.rows[0].pid, pid)
// Lot en brouillon : invisible, même dans la liste
assert.equal((await as(C1, `select * from public.lots`)).rows.length, 0)
assert.equal((await as(C1, `select * from public.project_lot_catalog($1)`, [pid])).rows.length, 0)
await fails(C1, `insert into public.lot_access (lot_id, user_id) values ('${lid}', '${C1}')`, 'demande sur un lot non publié')
// Publié : visible dans la liste (sans le DPGF), accès à demander
await as(B, `update public.lots set status = 'published' where id = $1`, [lid])
const cat = await as(C1, `select * from public.project_lot_catalog($1)`, [pid])
assert.equal(cat.rows.length, 1)
assert.equal(cat.rows[0].access, null)
assert.equal(cat.rows[0].line_count, 1)
assert.ok(!('items' in cat.rows[0]))
assert.equal((await as(C1, `select * from public.lots`)).rows.length, 0)
await fails(C1, `insert into public.offers (lot_id, company_id) values ('${lid}', '${C1}')`, 'offre sans accès au lot')
await fails(C1, `insert into public.lot_access (lot_id, user_id, status) values ('${lid}', '${C1}', 'approved')`, 'accès auto-accordé')
await as(C1, `insert into public.lot_access (lot_id, user_id) values ($1, $2)`, [lid, C1])
assert.equal((await as(C1, `update public.lot_access set status = 'approved' where lot_id = $1 returning lot_id`, [lid])).rows.length, 0)
assert.equal((await as(C1, `select * from public.lots`)).rows.length, 0)
assert.equal((await as(B, `select * from public.lot_access`)).rows.length, 1)
await as(B, `update public.lot_access set status = 'approved', decided_at = now() where lot_id = $1 and user_id = $2`, [lid, C1])
assert.equal((await as(C1, `select * from public.lots`)).rows.length, 1)
assert.equal((await as(C1, `select * from public.lot_private`)).rows.length, 0)
console.log('✓ lot : brouillon invisible, publié listé sans DPGF, accès sur demande validée par l’acheteur')
assert.equal((await as(C1, `select budget_prices from public.lot_private`)).rows.length, 0, 'prix budgets invisibles')
console.log('✓ entreprise : accès par code, lot visible, budget invisible')

// Ne pas répondre : motif obligatoire, visible de l'acheteur, réversible par l'entreprise
await fails(C1, `update public.lot_access set status = 'declined', comment = '  ' where lot_id = '${lid}' and user_id = '${C1}'`, 'ne pas répondre sans motif')
assert.equal((await as(C1, `update public.lot_access set status = 'declined', comment = 'Charge de travail' where lot_id = $1 and user_id = $2 returning lot_id`, [lid, C1])).rows.length, 1)
assert.equal((await as(B, `select comment from public.lot_access where lot_id = $1 and status = 'declined'`, [lid])).rows[0].comment, 'Charge de travail')
assert.equal((await as(C2, `update public.lot_access set status = 'declined', comment = 'intrus' where lot_id = $1 and user_id = $2 returning lot_id`, [lid, C2])).rows.length, 0, 'décliner sans accès')
assert.equal((await as(C1, `update public.lot_access set status = 'approved', comment = null where lot_id = $1 and user_id = $2 returning lot_id`, [lid, C1])).rows.length, 1, 'revenir sur sa décision')
console.log('✓ ne pas répondre : motif obligatoire, visible de l’acheteur, réversible')

// Offre de l'entreprise : brouillon invisible de l'acheteur, puis envoyée
const o = await as(C1, `insert into public.offers (lot_id, company_id, company_name, prices) values ($1, $2, 'TP Val-de-Seine', '{"a": 12}') returning id`, [lid, C1])
const oid = o.rows[0].id
assert.equal((await as(B, `select * from public.offers`)).rows.length, 0)
await as(C1, `update public.offers set status = 'submitted', submitted_at = now() where id = $1`, [oid])
assert.equal((await as(B, `select * from public.offers`)).rows.length, 1)
await fails(C1, `insert into public.offers (lot_id, company_id) values ('${lid}', '${C1}')`, 'deuxième offre sur le même lot')
console.log('✓ offre : brouillon privé, visible une fois envoyée, une seule par lot')

// L'acheteur ne peut pas modifier l'offre d'une entreprise
const upd = await as(B, `update public.offers set prices = '{"a": 1}' where id = $1 returning id`, [oid])
assert.equal(upd.rows.length, 0)
// …mais peut saisir une offre manuelle
await as(B, `insert into public.offers (lot_id, source, status, company_name) values ($1, 'manual', 'submitted', 'Réseaux IDF')`, [lid])
await fails(B, `insert into public.offers (lot_id, source, company_id) values ('${lid}', 'manual', '${C1}')`, 'offre manuelle au nom d’une entreprise inscrite')
console.log('✓ acheteur : offres des entreprises en lecture seule, offres manuelles possibles')

// Concurrence : C2 ne voit pas l'offre de C1 ni son profil, ni la demande d'accès de C1
await as(C2, `select public.join_project($1)`, [code])
assert.equal((await as(C2, `select * from public.lot_access`)).rows.length, 0)
assert.equal((await as(C2, `select * from public.lots`)).rows.length, 0)
assert.equal((await as(C2, `select * from public.offers`)).rows.length, 0)
assert.equal((await as(C2, `select * from public.profiles where id = '${C1}'`)).rows.length, 0)
assert.equal((await as(C2, `select * from public.project_members`)).rows.length, 1)
assert.equal((await as(B, `select * from public.profiles`)).rows.length, 3)
assert.equal((await as(C1, `select company_name from public.profiles where id = '${B}'`)).rows[0].company_name, 'Léon Grosse')
console.log('✓ cloisonnement entre entreprises, profils visibles par l’acheteur')

// Évaluation et commentaires internes
await as(B, `insert into public.offer_reviews (offer_id, lot_id, scores, verdict) values ($1, $2, '{"tech": 16}', 'favori')`, [oid, lid])
await as(B, `insert into public.offer_comments (offer_id, lot_id, author_id, body) values ($1, $2, $3, 'Très bon mémoire')`, [oid, lid, B])
assert.equal((await as(C1, `select * from public.offer_reviews`)).rows.length, 0)
assert.equal((await as(C1, `select * from public.offer_comments`)).rows.length, 0)
await fails(C1, `insert into public.offer_comments (offer_id, lot_id, author_id, body) values ('${oid}', '${lid}', '${C1}', 'x')`, 'commentaire par une entreprise')
console.log('✓ évaluation et commentaires réservés à l’acheteur')

// Date de rendu dépassée : l'offre est verrouillée
await as(B, `update public.lots set due_date = current_date - 1 where id = $1`, [lid])
const locked = await as(C1, `update public.offers set prices = '{"a": 9}' where id = $1 returning id`, [oid])
assert.equal(locked.rows.length, 0)
await as(B, `update public.lots set due_date = current_date + 3 where id = $1`, [lid])
const reopened = await as(C1, `update public.offers set prices = '{"a": 9}' where id = $1 returning id`, [oid])
assert.equal(reopened.rows.length, 1)
console.log('✓ offre verrouillée après la date de rendu, rouverte si l’acheteur la repousse')

// Lot suspendu : offre gelée ; accès refusé : le lot redevient invisible
await as(B, `update public.lots set status = 'suspended' where id = $1`, [lid])
assert.equal((await as(C1, `update public.offers set prices = '{"a": 8}' where id = $1 returning id`, [oid])).rows.length, 0)
assert.equal((await as(C1, `select * from public.lots`)).rows.length, 1)
await fails(C2, `insert into public.lot_access (lot_id, user_id) values ('${lid}', '${C2}')`, 'demande sur un lot suspendu')
await as(B, `update public.lots set status = 'published' where id = $1`, [lid])
await as(B, `update public.lot_access set status = 'refused' where lot_id = $1 and user_id = $2`, [lid, C1])
assert.equal((await as(C1, `select * from public.lots`)).rows.length, 0)
await as(B, `update public.lot_access set status = 'approved' where lot_id = $1 and user_id = $2`, [lid, C1])
console.log('✓ lot suspendu gelé, accès révocable par l’acheteur')

// Une entreprise ne peut pas modifier le lot ni créer de projet au nom d'un autre
const lotUpd = await as(C1, `update public.lots set name = 'pirate' where id = $1 returning id`, [lid])
assert.equal(lotUpd.rows.length, 0)
await fails(C1, `insert into public.projects (owner_id, name) values ('${B}', 'x')`, 'projet au nom d’un autre')
console.log('✓ lot non modifiable par une entreprise')

// Logos : chacun dans son dossier
await as(C1, `insert into storage.objects (bucket_id, name) values ('logos', '${C1}/logo.png')`)
await fails(C1, `insert into storage.objects (bucket_id, name) values ('logos', '${C2}/logo.png')`, 'logo dans le dossier d’un autre')
console.log('✓ stockage des logos cloisonné')

// Notice technique : dépôt dans son dossier sur un lot accessible, lecture par l'acheteur une fois l'offre envoyée
const f1 = `${lid}/${C1}/${oid}.pdf`
await as(C1, `insert into storage.objects (bucket_id, name) values ('offer-files', $1)`, [f1])
await fails(C2, `insert into storage.objects (bucket_id, name) values ('offer-files', '${lid}/${C2}/x.pdf')`, 'notice sans accès au lot')
await fails(C2, `insert into storage.objects (bucket_id, name) values ('offer-files', '${lid}/${C1}/x.pdf')`, 'notice dans le dossier d’un autre')
await fails(C1, `insert into storage.objects (bucket_id, name) values ('offer-files', '${lid}/manual/x.pdf')`, 'notice au nom de l’acheteur')
assert.equal((await as(C1, `select name from storage.objects where bucket_id = 'offer-files'`)).rows.length, 1)
assert.equal((await as(C2, `select name from storage.objects where bucket_id = 'offer-files'`)).rows.length, 0, 'notice invisible des concurrents')
const st = (await as(B, `select status from public.offers where id = $1`, [oid])).rows[0]?.status
assert.equal((await as(B, `select name from storage.objects where bucket_id = 'offer-files'`)).rows.length, st === 'submitted' ? 1 : 0)
await as(B, `insert into storage.objects (bucket_id, name) values ('offer-files', '${lid}/manual/y.pdf')`)
await as(C1, `update public.offers set tech_note = '{"path":"p","name":"n.pdf","size":1,"at":"x"}' where id = $1`, [oid])
console.log('✓ notice technique : dépôt cloisonné, lecture par l’acheteur après envoi')

// Notifications : créées par la base, lisibles par leur seul destinataire, non falsifiables
const nB = (await as(B, `select kind, read_at, data from public.notifications order by created_at`)).rows
assert.ok(nB.some((n) => n.kind === 'access_requested' && n.data.company === 'TP Val-de-Seine'), 'demande d’accès notifiée à l’acheteur')
assert.ok(nB.filter((n) => n.kind === 'access_requested').every((n) => n.read_at), 'demandes traitées : alertes soldées')
assert.ok(nB.some((n) => n.kind === 'lot_declined' && n.data.comment), 'refus de répondre notifié avec son motif')
const nC1 = (await as(C1, `select kind, user_id from public.notifications`)).rows
assert.ok(nC1.some((n) => n.kind === 'access_approved'), 'accès accepté notifié à l’entreprise')
assert.ok(nC1.some((n) => n.kind === 'access_refused'), 'accès refusé notifié à l’entreprise')
assert.ok(nC1.every((n) => n.user_id === C1), 'aucune alerte d’un autre compte')
await fails(C1, `insert into public.notifications (user_id, kind) values ('${B}', 'access_requested')`, 'alerte fabriquée')
await fails(C1, `update public.notifications set data = '{}' where user_id = '${C1}'`, 'contenu d’alerte modifié')
await as(C1, `update public.notifications set read_at = now() where user_id = $1`, [C1])
const stolen = await as(C2, `update public.notifications set read_at = now() where user_id = $1 returning id`, [C1])
assert.equal(stolen.rows.length, 0)
console.log('✓ notifications : créées par la base, cloisonnées, non falsifiables')

// Demandes SSO : déposées sans compte par request_sso(), lues et traitées par le seul administrateur
const A = '44444444-4444-4444-4444-444444444444'
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${A}', 'baziventillateur@gmail.com', '{"role":"buyer","company_name":"Batimatch"}')`)
async function anon(sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`)
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec('reset role')
  }
}
await anon(`select public.request_sso('Grand Groupe BTP', 'Claire Martin', ' Claire.Martin@GrandGroupe.fr ', '01 02 03 04 05', '51 à 200', 'microsoft', 'Nous utilisons Microsoft 365.')`)
await anon(`select public.request_sso('Grand Groupe BTP', 'Claire Martin', 'claire.martin@grandgroupe.fr')`) // doublon du jour : ignoré
let anonFails = 0
for (const sql of [
  `select public.request_sso('G', 'Claire Martin', 'a@b.fr')`,
  `select public.request_sso('Grand Groupe', 'Claire Martin', 'pas-un-email')`,
  `select * from public.sso_requests`,
  `insert into public.sso_requests (company_name, email) values ('x', 'x@y.fr')`,
  `select public.admin_ids()`,
]) {
  try {
    await anon(sql)
  } catch {
    anonFails++
  }
}
assert.equal(anonFails, 5, 'sans compte : seule request_sso() avec des données valides est possible')
const reqs = (await as(A, `select * from public.sso_requests`)).rows
assert.equal(reqs.length, 1, 'une seule demande malgré le doublon')
assert.equal(reqs[0].email, 'claire.martin@grandgroupe.fr')
assert.equal(reqs[0].status, 'new')
const rid = reqs[0].id
assert.equal((await as(B, `select * from public.sso_requests`)).rows.length, 0, 'demandes invisibles des autres comptes')
assert.equal((await as(C1, `select * from public.sso_messages`)).rows.length, 0)
assert.equal((await as(B, `update public.sso_requests set status = 'activated' returning id`)).rows.length, 0)
await fails(C1, `insert into public.sso_messages (request_id, kind, subject, body) values ('${rid}', 'reply', 'Bonjour', 'Message pirate')`, 'réponse envoyée par un non-admin')
const nA = (await as(A, `select kind, data, read_at from public.notifications`)).rows
assert.equal(nA.length, 1)
assert.equal(nA[0].kind, 'sso_requested')
assert.equal(nA[0].data.company, 'Grand Groupe BTP')
assert.equal((await as(B, `select * from public.notifications where kind = 'sso_requested'`)).rows.length, 0)
assert.deepEqual((await as(A, `select kind from public.sso_messages`)).rows.map((m) => m.kind), ['ack'])
await fails(A, `insert into public.sso_messages (request_id, kind) values ('${rid}', 'ack')`, 'accusé de réception fabriqué')
await fails(A, `insert into public.sso_messages (request_id, kind, subject, body) values ('${rid}', 'reply', '', '')`, 'réponse vide')
await as(A, `insert into public.sso_messages (request_id, kind, subject, body) values ($1, 'reply', 'Votre demande', 'Bonjour, parlons-en.')`, [rid])
assert.equal((await as(A, `select status from public.sso_requests`)).rows[0].status, 'contacted', 'répondre fait passer la demande à « contactée »')
assert.ok((await as(A, `select read_at from public.notifications`)).rows[0].read_at, 'alerte soldée une fois la réponse envoyée')
await as(A, `update public.sso_requests set status = 'activated', admin_note = 'Tenant reçu' where id = $1`, [rid])
await fails(A, `update public.sso_requests set email = 'autre@x.fr' where id = '${rid}'`, 'coordonnées de la demande modifiées')
await as(A, `delete from public.sso_requests where id = $1`, [rid])
assert.equal((await as(A, `select * from public.sso_messages`)).rows.length, 0)
console.log('✓ demandes SSO : dépôt sans compte encadré, traitement réservé à l’administrateur')

// Copie et verrouillage
await fails(C1, `select public.copy_project('${pid}')`, 'copie par un autre compte')
const cp = (await as(B, `select public.copy_project($1) as id`, [pid])).rows[0].id
const cpLots = (await as(B, `select id, status from public.lots where project_id = $1`, [cp])).rows
const srcLots = (await as(B, `select id from public.lots where project_id = $1`, [pid])).rows
assert.equal(cpLots.length, srcLots.length, 'tous les lots copiés')
assert.ok(cpLots.every((l) => l.status === 'draft'), 'lots de la copie en brouillon')
const cpOffers = (await as(B, `select company_id, source from public.offers where lot_id = any($1)`, [cpLots.map((l) => l.id)])).rows
assert.ok(cpOffers.length > 0 && cpOffers.every((o) => o.company_id === null && o.source === 'manual'), 'offres copiées détachées des entreprises')
assert.equal((await as(C1, `select * from public.projects where id = $1`, [cp])).rows.length, 0, 'copie invisible des entreprises')
assert.equal((await as(B, `select count(*)::int n from public.project_members where project_id = $1`, [cp])).rows[0].n, 0)

await fails(C1, `select public.lock_project('${cp}', '1234')`, 'verrouillage par un autre compte')
await fails(B, `select public.lock_project('${cp}')`, 'premier verrouillage sans code')
await fails(B, `select public.lock_project('${cp}', '12')`, 'code trop court')
await as(B, `select public.lock_project($1, $2)`, [cp, 'trame-2026'])
assert.ok((await as(B, `select locked_at from public.projects where id = $1`, [cp])).rows[0].locked_at, 'projet verrouillé')
assert.ok((await as(B, `select * from public.lots where project_id = $1`, [cp])).rows.length > 0, 'consultation toujours possible')
await fails(B, `update public.projects set name = 'x' where id = '${cp}'`, 'modifier un projet verrouillé')
await fails(B, `delete from public.projects where id = '${cp}'`, 'supprimer un projet verrouillé')
await fails(B, `update public.projects set locked_at = null where id = '${cp}'`, 'déverrouiller sans le code')
await fails(B, `update public.lots set name = 'x' where project_id = '${cp}'`, 'modifier un lot verrouillé')
await fails(B, `insert into public.lots (project_id, name) values ('${cp}', 'Nouveau')`, 'ajouter un lot à un projet verrouillé')
await fails(B, `update public.offers set discount_pct = 5 where lot_id = '${cpLots[0].id}'`, 'modifier une offre verrouillée')
await fails(B, `update public.lot_private set budget = 1 where lot_id = '${cpLots[0].id}'`, 'modifier un budget verrouillé')
await fails(B, `select * from public.project_locks`, 'lecture du code de verrouillage')
assert.equal((await as(B, `select public.unlock_project($1, $2) as r`, [cp, 'faux'])).rows[0].r, 'wrong')
assert.ok((await as(B, `select locked_at from public.projects where id = $1`, [cp])).rows[0].locked_at, 'toujours verrouillé après un code faux')
await fails(C1, `select public.unlock_project('${cp}', 'trame-2026')`, 'déverrouillage par un autre compte')
for (let i = 0; i < 4; i++) await as(B, `select public.unlock_project($1, 'faux')`, [cp])
assert.equal((await as(B, `select public.unlock_project($1, $2) as r`, [cp, 'trame-2026'])).rows[0].r, 'blocked', 'cinq codes faux bloquent les essais')
await db.exec(`update public.project_locks set failed_at = now() - interval '20 minutes'`)
assert.equal((await as(B, `select public.unlock_project($1, $2) as r`, [cp, 'trame-2026'])).rows[0].r, 'ok')
await as(B, `update public.lots set name = name where project_id = $1`, [cp])
await as(B, `select public.lock_project($1)`, [cp]) // le code existe déjà : un appel suffit
// Code oublié : code à usage unique, puis nouveau code
await as(B, `select public.request_lock_reset($1)`, [cp])
await fails(B, `select public.request_lock_reset('${cp}')`, 'deuxième demande de code trop rapprochée')
const reset = (await db.query(`select reset_code from public.project_locks where project_id = $1`, [cp])).rows[0].reset_code
assert.match(reset, /^\d{6}$/)
assert.equal((await as(B, `select public.reset_lock_code($1, '000000x', 'nouveau1') as r`, [cp])).rows[0].r, 'wrong')
assert.equal((await as(B, `select public.reset_lock_code($1, $2, 'nouveau1') as r`, [cp, reset])).rows[0].r, 'ok')
assert.equal((await as(B, `select locked_at from public.projects where id = $1`, [cp])).rows[0].locked_at, null)
await as(B, `select public.lock_project($1)`, [cp])
assert.equal((await as(B, `select public.unlock_project($1, 'trame-2026') as r`, [cp])).rows[0].r, 'wrong', 'ancien code refusé')
assert.equal((await as(B, `select public.unlock_project($1, 'nouveau1') as r`, [cp])).rows[0].r, 'ok')
// Un projet verrouillé gèle aussi les entreprises
await as(B, `select public.lock_project($1, 'gel-projet')`, [pid])
let frozen = 0
try { frozen = (await as(C1, `update public.offers set discount_pct = 1 where company_id = $1 returning id`, [C1])).rows.length } catch { frozen = 0 }
assert.equal(frozen, 0, 'offre d’une entreprise gelée sur un projet verrouillé')
assert.equal((await as(B, `select public.unlock_project($1, 'gel-projet') as r`, [pid])).rows[0].r, 'ok')
await as(B, `delete from public.projects where id = $1`, [cp])
console.log('✓ copie de projet, verrouillage par code, code oublié')

// Relance : réservée à l'acheteur, pour une entreprise acceptée sans offre sur un lot ouvert, une fois par 24 h
const rl = (await as(B, `insert into public.lots (project_id, name, due_date, status, items) values ($1, 'Lot relance', current_date + 5, 'published', '[]') returning id`, [pid])).rows[0].id
await fails(B, `select public.remind_company('${rl}', '${C2}')`, 'relance sans accès accepté')
await as(C2, `insert into public.lot_access (lot_id, user_id) values ($1, $2)`, [rl, C2])
await as(B, `update public.lot_access set status = 'approved', decided_at = now() where lot_id = $1 and user_id = $2`, [rl, C2])
await fails(C1, `select public.remind_company('${rl}', '${C2}')`, 'relance par un autre compte')
await fails(C2, `select public.remind_company('${rl}', '${C2}')`, 'relance par l’entreprise elle-même')
assert.equal((await as(B, `select public.remind_company($1, $2) as r`, [rl, C2])).rows[0].r, 'sent')
await fails(B, `select public.remind_company('${rl}', '${C2}')`, 'deuxième relance dans les 24 h')
const rem = (await as(C2, `select kind, data, actor_id from public.notifications where kind = 'offer_reminder'`)).rows
assert.equal(rem.length, 1)
assert.equal(rem[0].data.lot, 'Lot relance')
assert.equal(rem[0].data.buyer, 'Léon Grosse')
assert.equal((await as(C1, `select * from public.notifications where kind = 'offer_reminder'`)).rows.length, 0)
assert.equal((await as(B, `select * from public.lot_reminders($1)`, [rl])).rows.length, 1)
assert.equal((await as(C1, `select * from public.lot_reminders($1)`, [rl])).rows.length, 0, 'relances invisibles des autres comptes')
await db.exec(`update public.notifications set created_at = now() - interval '2 days' where kind = 'offer_reminder'`)
await as(C2, `insert into public.offers (lot_id, company_id, status, submitted_at) values ($1, $2, 'submitted', now())`, [rl, C2])
await fails(B, `select public.remind_company('${rl}', '${C2}')`, 'relance d’une entreprise qui a répondu')
await as(B, `update public.lots set due_date = current_date - 1 where id = $1`, [rl])
await fails(B, `select public.remind_company('${rl}', '${C1}')`, 'relance sur un lot clôturé')
console.log('✓ relance : acheteur seulement, entreprise acceptée sans offre, une par 24 h')

// Projet exemple : copie du modèle dans le compte de l'acheteur, sans alerte ni accès pour les autres
await fails(B, `select public.open_example_project()`, 'exemple avant installation du modèle')
await db.exec(example)
await db.exec(example) // relançable
const demoAccounts = (await db.query(`select id, banned_until, encrypted_password from auth.users where email like '%.example'`)).rows
assert.ok(demoAccounts.length >= 10 && demoAccounts.every((u) => u.banned_until > new Date('2900-01-01') && u.encrypted_password === ''), 'comptes fictifs bloqués')
await fails(C1, `select public.open_example_project()`, 'exemple ouvert par une entreprise')
const notifBefore = (await db.query(`select count(*)::int as n from public.notifications`)).rows[0].n
const ex = (await as(B, `select public.open_example_project() as id`)).rows[0].id
assert.equal((await as(B, `select public.open_example_project() as id`)).rows[0].id, ex, 'un seul exemple par acheteur')
const exProject = (await as(B, `select * from public.projects where id = $1`, [ex])).rows[0]
assert.equal(exProject.is_example, true)
assert.equal(exProject.owner_id, B)
const exLots = (await as(B, `select id, status, due_date from public.lots where project_id = $1`, [ex])).rows
assert.ok(exLots.length >= 5, 'au moins 5 lots')
const exIds = exLots.map((l) => l.id)
const exOffers = (await as(B, `select * from public.offers where lot_id = any($1)`, [exIds])).rows
assert.ok(exOffers.length >= 8, 'offres visibles de l’acheteur')
assert.ok(exOffers.some((o) => o.source === 'manual') && exOffers.some((o) => o.source === 'platform'))
const exAccess = (await as(B, `select status from public.lot_access where lot_id = any($1)`, [exIds])).rows.map((a) => a.status)
for (const st of ['pending', 'approved', 'refused', 'declined']) assert.ok(exAccess.includes(st), `accès « ${st} » présent`)
const awarded = (await as(B, `select awarded_offer_id from public.lot_private where lot_id = any($1) and awarded_offer_id is not null`, [exIds])).rows
assert.equal(awarded.length, 1)
assert.ok(exOffers.some((o) => o.id === awarded[0].awarded_offer_id), 'offre retenue présente')
assert.ok((await as(B, `select * from public.offer_reviews where lot_id = any($1)`, [exIds])).rows.length > 0)
assert.ok((await as(B, `select * from public.offer_comments where lot_id = any($1)`, [exIds])).rows.length > 0)
const exMembers = (await as(B, `select m.user_id, p.logo_url from public.project_members m join public.profiles p on p.id = m.user_id where m.project_id = $1`, [ex])).rows
assert.ok(exMembers.length >= 10 && exMembers.every((m) => m.logo_url?.startsWith('exemple/logos/')), 'entreprises visibles avec leur logo')
// Accepter la demande en attente ne crée ni alerte ni e-mail
const pendingRow = (await as(B, `select lot_id, user_id from public.lot_access where lot_id = any($1) and status = 'pending'`, [exIds])).rows[0]
await as(B, `update public.lot_access set status = 'approved', decided_at = now() where lot_id = $1 and user_id = $2`, [pendingRow.lot_id, pendingRow.user_id])
assert.equal((await db.query(`select count(*)::int as n from public.notifications`)).rows[0].n, notifBefore, 'aucune alerte pour l’exemple')
// Relancer une entreprise fictive : accepté, mais rien n'est envoyé
const exOpen = (await as(B, `select a.lot_id, a.user_id from public.lot_access a join public.lots l on l.id = a.lot_id where l.project_id = $1 and a.status = 'approved' and l.due_date >= current_date and not exists (select 1 from public.offers o where o.lot_id = a.lot_id and o.company_id = a.user_id) limit 1`, [ex])).rows[0]
assert.equal((await as(B, `select public.remind_company($1, $2) as r`, [exOpen.lot_id, exOpen.user_id])).rows[0].r, 'example')
assert.equal((await db.query(`select count(*)::int as n from public.notifications`)).rows[0].n, notifBefore, 'aucune relance réelle dans l’exemple')
// Les autres comptes ne voient rien, et le code du projet exemple ne permet pas de le rejoindre
assert.equal((await as(C1, `select * from public.projects where id = $1`, [ex])).rows.length, 0)
assert.equal((await as(C2, `select * from public.offers where lot_id = any($1)`, [exIds])).rows.length, 0)
await fails(C1, `select public.join_project('${exProject.access_code}')`, 'rejoindre un projet exemple')
await fails(B, `select * from public.example_template`, 'lecture directe du modèle')
const B2 = '55555555-5555-5555-5555-555555555555'
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${B2}', 'acheteur2@test.fr', '{"role":"buyer"}')`)
const ex2 = (await as(B2, `select public.open_example_project() as id`)).rows[0].id
assert.notEqual(ex2, ex)
assert.equal((await as(B2, `select * from public.projects where id = $1`, [ex])).rows.length, 0, 'exemple d’un autre acheteur invisible')
assert.equal((await as(B2, `select * from public.offers where lot_id = any($1)`, [exIds])).rows.length, 0)
// Supprimer l'exemple puis le rouvrir en donne un neuf
await as(B, `delete from public.projects where id = $1`, [ex])
const ex3 = (await as(B, `select public.open_example_project() as id`)).rows[0].id
assert.notEqual(ex3, ex)
assert.equal((await as(B, `select count(*)::int as n from public.lot_access where status = 'pending' and lot_id in (select id from public.lots where project_id = $1)`, [ex3])).rows[0].n, 1)
console.log('✓ projet exemple : copie privée par acheteur, comptes fictifs bloqués, aucune alerte')

console.log('\nTous les tests de sécurité passent.')
