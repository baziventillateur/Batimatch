// Test des règles d'accès du schéma sur un Postgres local (PGlite) qui simule Supabase.
// Lancer : node supabase/test/rls.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const db = new PGlite()
const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')

// — Simulation minimale de Supabase : rôles, auth.users, auth.uid(), stockage —
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
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

console.log('\nTous les tests de sécurité passent.')
