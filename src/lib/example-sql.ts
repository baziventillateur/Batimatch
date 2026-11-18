// Génère supabase/example.sql à partir de src/lib/example.ts (voir example.test.ts).
import { EXAMPLE_ACCOUNTS, buildExampleTemplate } from './example'

const lit = (v: string) => `'${v.replace(/'/g, "''")}'`

export function exampleSql(): string {
  const t = buildExampleTemplate()
  const json = JSON.stringify(t, null, 1)
  if (json.includes('$exemple$')) throw new Error('Le modèle contient le délimiteur $exemple$')
  const users = EXAMPLE_ACCOUNTS.map((c) => {
    const meta = JSON.stringify({ role: 'company', first_name: c.first_name, last_name: c.last_name, company_name: c.company_name, phone: c.phone })
    return `  ('00000000-0000-0000-0000-000000000000', ${lit(c.id)}, 'authenticated', 'authenticated', ${lit(c.email)}, '', '{"provider":"email","providers":["email"]}', ${lit(meta)}, now(), now(), '2999-12-31 00:00:00+00', '', '', '', '')`
  })
  const profiles = EXAMPLE_ACCOUNTS.map(
    (c) => `  (${lit(c.id)}, 'company', ${lit(c.email)}, ${lit(c.first_name)}, ${lit(c.last_name)}, ${lit(c.company_name)}, ${lit(c.phone)}, ${lit(c.logo_url)})`,
  )
  return `-- ═══════════════════════════════════════════════════════════════════════════
-- Batimatch : projet exemple (entreprises fictives et modèle du projet)
-- Fichier généré depuis src/lib/example.ts par src/lib/example.test.ts : ne pas le modifier à la main
-- (après une modification de l'exemple : npx vitest run -u).
-- À exécuter après schema.sql, dans Supabase → SQL Editor. Peut être relancé sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- Comptes des entreprises fictives : sans mot de passe, adresse non confirmée et bloqués jusqu'en 2999.
-- Personne ne peut s'y connecter ; ils servent seulement d'auteurs aux offres de l'exemple.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at, banned_until, confirmation_token, recovery_token, email_change_token_new, email_change)
values
${users.join(',\n')}
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = '',
  raw_user_meta_data = excluded.raw_user_meta_data,
  banned_until = excluded.banned_until;

-- Profils (avec les logos de public/exemple/logos)
insert into public.profiles (id, role, email, first_name, last_name, company_name, phone, logo_url)
values
${profiles.join(',\n')}
on conflict (id) do update set
  role = excluded.role,
  email = excluded.email,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  company_name = excluded.company_name,
  phone = excluded.phone,
  logo_url = excluded.logo_url;

-- Modèle copié par open_example_project() (dates en jours par rapport au jour de la copie)
insert into public.example_template (id, data, updated_at)
values (1, $exemple$${json}$exemple$::jsonb, now())
on conflict (id) do update set data = excluded.data, updated_at = now();
`
}
