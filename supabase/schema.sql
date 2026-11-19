-- ═══════════════════════════════════════════════════════════════════════════
-- Batimatch : schéma de la base Supabase
-- À coller en une fois dans Supabase → SQL Editor → New query → Run.
-- Le script peut être relancé sans risque (il ne supprime aucune donnée).
--
-- Deux profils d'utilisateurs :
--   • acheteur (buyer)   : crée des projets, des lots (DPGF + date de rendu),
--                          voit les offres envoyées, évalue et commente en interne ;
--   • entreprise (company) : rejoint un projet avec son code d'accès, répond aux lots,
--                          modifie son offre jusqu'à la date de rendu.
-- La sécurité est assurée par les règles RLS ci-dessous : une entreprise ne voit
-- jamais le budget, les offres concurrentes, ni les notes et commentaires internes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Profils ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'company' check (role in ('buyer', 'company')),
  email text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  company_name text not null default '',
  phone text not null default '',
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Création automatique du profil à l'inscription (données saisies dans le formulaire)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, first_name, last_name, company_name, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    case when new.raw_user_meta_data ->> 'role' = 'buyer' then 'buyer' else 'company' end,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.raw_user_meta_data ->> 'company_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Projets ────────────────────────────────────────────────────────────────
-- Code d'accès court, sans caractères ambigus (pas de O/0, I/1, L)
create or replace function public.gen_access_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.projects where access_code = candidate);
  end loop;
  return candidate;
end;
$$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  reference text not null default '',
  description text not null default '',
  access_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projet exemple : copie du modèle proposé à chaque acheteur (voir open_example_project plus bas)
alter table public.projects add column if not exists is_example boolean not null default false;
-- Projet verrouillé : consultable mais plus modifiable (voir « Copie et verrouillage d'un projet » plus bas)
alter table public.projects add column if not exists locked_at timestamptz;

create or replace function public.set_access_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.access_code is null or new.access_code = '' then
    new.access_code := public.gen_access_code();
  end if;
  return new;
end;
$$;

drop trigger if exists projects_access_code on public.projects;
create trigger projects_access_code
  before insert on public.projects
  for each row execute function public.set_access_code();

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- ─── Lots (demandes d'offre) ────────────────────────────────────────────────
create table if not exists public.lots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null default '',
  code text not null default '',
  description text not null default '',
  due_date date,
  items jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lots_project_idx on public.lots (project_id);

-- Publication du lot : draft = invisible des entreprises ; published = visible, demandes d'accès et réponses ouvertes ;
-- suspended = visible mais gelé (plus de demande ni de modification d'offre).
-- Les lots créés avant cette colonne restent publiés ; les nouveaux naissent en brouillon.
alter table public.lots add column if not exists status text not null default 'published';
alter table public.lots alter column status set default 'draft';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lots_status_check') then
    alter table public.lots add constraint lots_status_check check (status in ('draft', 'published', 'suspended'));
  end if;
end $$;

-- Accès d'une entreprise à un lot : demandé par l'entreprise, validé par l'acheteur
create table if not exists public.lot_access (
  lot_id uuid not null references public.lots (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'refused', 'declined')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  -- Motif de « ne pas répondre » (obligatoire pour declined), visible de l'acheteur
  comment text,
  primary key (lot_id, user_id)
);
create index if not exists lot_access_user_idx on public.lot_access (user_id);

-- Mises à jour pour les bases déjà créées : statut « declined » et motif
alter table public.lot_access add column if not exists comment text;
alter table public.lot_access drop constraint if exists lot_access_status_check;
alter table public.lot_access add constraint lot_access_status_check check (status in ('pending', 'approved', 'refused', 'declined'));

-- ─── Notifications (cloche) ─────────────────────────────────────────────────
-- Une ligne par alerte destinée à un utilisateur. Elles sont créées par la base elle-même
-- (déclencheur sur lot_access), jamais par l'application : personne ne peut en fabriquer.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('access_requested', 'access_approved', 'access_refused', 'lot_declined', 'sso_requested', 'offer_reminder')),
  project_id uuid references public.projects (id) on delete cascade,
  lot_id uuid references public.lots (id) on delete cascade,
  -- Celui qui a provoqué l'alerte (l'entreprise qui demande, l'acheteur qui décide)
  actor_id uuid references auth.users (id) on delete set null,
  -- Libellés figés au moment de l'alerte : projet, lot, entreprise, contact, motif
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- Mise à jour pour les bases déjà créées : alertes « demande de connexion SSO » (administrateur) et « relance » (entreprise)
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('access_requested', 'access_approved', 'access_refused', 'lot_declined', 'sso_requested', 'offer_reminder'));

create or replace function public.notify_lot_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_lot public.lots;
  v_company public.profiles;
  v_data jsonb;
begin
  select * into v_lot from public.lots where id = new.lot_id;
  select * into v_project from public.projects where id = v_lot.project_id;
  -- Projet exemple : les entreprises sont fictives, aucune alerte ni aucun e-mail
  if v_project.is_example then
    return new;
  end if;
  select * into v_company from public.profiles where id = new.user_id;
  v_data := jsonb_build_object(
    'project', v_project.name,
    'lot', v_lot.name,
    'company', coalesce(nullif(v_company.company_name, ''), trim(v_company.first_name || ' ' || v_company.last_name)),
    'contact', trim(coalesce(v_company.first_name, '') || ' ' || coalesce(v_company.last_name, ''))
  );

  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      insert into public.notifications (user_id, kind, project_id, lot_id, actor_id, data)
      values (v_project.owner_id, 'access_requested', v_project.id, v_lot.id, new.user_id, v_data);
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    -- La demande est traitée : l'alerte « à valider » de l'acheteur n'a plus lieu d'être
    if old.status = 'pending' then
      update public.notifications set read_at = now()
      where kind = 'access_requested' and lot_id = new.lot_id and actor_id = new.user_id and read_at is null;
    end if;
    if new.status = 'approved' and old.status <> 'declined' then
      insert into public.notifications (user_id, kind, project_id, lot_id, actor_id, data)
      values (new.user_id, 'access_approved', v_project.id, v_lot.id, v_project.owner_id, v_data);
    elsif new.status = 'refused' then
      insert into public.notifications (user_id, kind, project_id, lot_id, actor_id, data)
      values (new.user_id, 'access_refused', v_project.id, v_lot.id, v_project.owner_id, v_data);
    elsif new.status = 'declined' then
      insert into public.notifications (user_id, kind, project_id, lot_id, actor_id, data)
      values (v_project.owner_id, 'lot_declined', v_project.id, v_lot.id, new.user_id, v_data || jsonb_build_object('comment', new.comment));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists lot_access_notify on public.lot_access;
create trigger lot_access_notify
  after insert or update on public.lot_access
  for each row execute function public.notify_lot_access();

-- Envoi de l'e-mail : la base appelle la fonction « notify-email » avec l'identifiant de l'alerte.
-- La fonction relit l'alerte elle-même et ne l'envoie qu'une fois : l'appel ne transporte aucun contenu.
do $$ begin
  create extension if not exists pg_net;
exception when others then null; -- absent hors Supabase (tests locaux)
end $$;

create or replace function public.notification_send_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind in ('access_requested', 'access_approved', 'sso_requested', 'offer_reminder')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform net.http_post(
      url := 'https://uhdanxctslncwwmcziba.supabase.co/functions/v1/notify-email',
      body := jsonb_build_object('id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
  return new;
exception when others then
  return new; -- un e-mail qui ne part pas ne doit jamais bloquer la demande d'accès
end;
$$;

drop trigger if exists notifications_email on public.notifications;
create trigger notifications_email
  after insert on public.notifications
  for each row execute function public.notification_send_email();

-- ─── Demandes de connexion SSO (grandes entreprises) ────────────────────────
-- Sur la page de connexion, une entreprise peut demander l'activation de la connexion unique
-- (SSO Microsoft). La demande est créée par request_sso(), seule porte d'entrée ouverte sans compte ;
-- elle est ensuite lue et traitée uniquement par l'administrateur, depuis le panneau admin.

-- Comptes administrateurs de la plateforme (adresse vérifiée)
create or replace function public.admin_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from auth.users
  where lower(email) = 'baziventillateur@gmail.com' and email_confirmed_at is not null
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and auth.uid() in (select public.admin_ids())
$$;

create table if not exists public.sso_requests (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null default '',
  email text not null,
  phone text not null default '',
  -- Tranche indicative saisie par l'entreprise (« 11 à 50 »…)
  user_count text not null default '',
  provider text not null default 'microsoft' check (provider in ('microsoft', 'other')),
  message text not null default '',
  -- new = à traiter ; contacted = réponse envoyée ; in_progress = activation en cours ; activated ; declined = sans suite
  status text not null default 'new' check (status in ('new', 'contacted', 'in_progress', 'activated', 'declined')),
  -- Note interne de l'administrateur, jamais envoyée
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sso_requests_created_idx on public.sso_requests (created_at desc);
create index if not exists sso_requests_email_idx on public.sso_requests (email, created_at desc);

-- E-mails envoyés à l'entreprise : accusé de réception automatique (ack) et réponses de l'administrateur (reply)
create table if not exists public.sso_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.sso_requests (id) on delete cascade,
  kind text not null check (kind in ('ack', 'reply')),
  subject text not null default '' check (length(subject) <= 200),
  body text not null default '' check (length(body) <= 5000),
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind = 'ack' or (length(trim(subject)) > 0 and length(trim(body)) > 0))
);
create index if not exists sso_messages_request_idx on public.sso_messages (request_id, created_at);

-- Dépôt d'une demande, avec ou sans compte. Les garde-fous évitent que le formulaire serve à
-- inonder une boîte mail : une seule demande par adresse et par jour, et un plafond global par heure.
create or replace function public.request_sso(
  p_company text,
  p_contact text,
  p_email text,
  p_phone text default '',
  p_users text default '',
  p_provider text default 'microsoft',
  p_message text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company text := left(trim(coalesce(p_company, '')), 120);
  v_contact text := left(trim(coalesce(p_contact, '')), 120);
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := left(trim(coalesce(p_phone, '')), 40);
  v_users text := left(trim(coalesce(p_users, '')), 40);
  v_message text := left(trim(coalesce(p_message, '')), 2000);
  v_id uuid;
begin
  if length(v_company) < 2 then raise exception 'sso_company'; end if;
  if length(v_contact) < 2 then raise exception 'sso_contact'; end if;
  if length(v_email) > 200 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' then raise exception 'sso_email'; end if;

  -- Déjà demandé aujourd'hui avec cette adresse : rien de plus à faire, la première demande suit son cours
  if exists (select 1 from public.sso_requests where email = v_email and created_at > now() - interval '24 hours') then
    return;
  end if;
  if (select count(*) from public.sso_requests where created_at > now() - interval '1 hour') >= 10 then
    raise exception 'sso_busy';
  end if;

  insert into public.sso_requests (company_name, contact_name, email, phone, user_count, provider, message)
  values (v_company, v_contact, v_email, v_phone, v_users, case when p_provider = 'other' then 'other' else 'microsoft' end, v_message)
  returning id into v_id;

  -- Accusé de réception pour l'entreprise (texte fixe, composé par la fonction d'envoi)
  insert into public.sso_messages (request_id, kind) values (v_id, 'ack');

  -- Alerte dans la cloche de l'administrateur, doublée d'un e-mail
  insert into public.notifications (user_id, kind, data)
  select a, 'sso_requested', jsonb_build_object(
    'request', v_id, 'company', v_company, 'contact', v_contact, 'email', v_email,
    'phone', v_phone, 'users', v_users, 'provider', case when p_provider = 'other' then 'other' else 'microsoft' end,
    'message', left(v_message, 600))
  from public.admin_ids() a;
end;
$$;

-- À chaque message : envoi de l'e-mail par la fonction « notify-email » (qui relit le message elle-même),
-- et une demande à laquelle l'administrateur vient de répondre n'est plus « à traiter ».
create or replace function public.sso_message_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'reply' then
    update public.sso_requests set status = 'contacted' where id = new.request_id and status = 'new';
    update public.notifications set read_at = now()
    where kind = 'sso_requested' and read_at is null and data ->> 'request' = new.request_id::text;
  end if;
  begin
    if exists (select 1 from pg_extension where extname = 'pg_net') then
      perform net.http_post(
        url := 'https://uhdanxctslncwwmcziba.supabase.co/functions/v1/notify-email',
        body := jsonb_build_object('sso_message', new.id),
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
    end if;
  exception when others then null; -- un e-mail qui ne part pas ne doit pas faire échouer la demande
  end;
  return new;
end;
$$;

drop trigger if exists sso_messages_created on public.sso_messages;
create trigger sso_messages_created
  after insert on public.sso_messages
  for each row execute function public.sso_message_created();

-- Données réservées à l'acheteur : budget, réglages et critères, décision
create table if not exists public.lot_private (
  lot_id uuid primary key references public.lots (id) on delete cascade,
  budget numeric,
  -- Prix unitaires budget par ligne du DPGF : { "<id ligne>": montant }. Jamais visibles des entreprises.
  budget_prices jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  awarded_offer_id uuid,
  updated_at timestamptz not null default now()
);
-- Pour une base déjà créée avant cette colonne
alter table public.lot_private add column if not exists budget_prices jsonb not null default '{}'::jsonb;

-- ─── Offres ─────────────────────────────────────────────────────────────────
-- source = platform : déposée par l'entreprise elle-même ;
-- source = manual   : saisie par l'acheteur (offre reçue par mail, négociation…)
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots (id) on delete cascade,
  company_id uuid references auth.users (id) on delete set null,
  source text not null default 'platform' check (source in ('platform', 'manual')),
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  version integer not null default 1,
  company_name text not null default '',
  contact_first_name text not null default '',
  contact_last_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  logo_url text,
  received_at date,
  prices jsonb not null default '{}'::jsonb,
  discount_pct numeric not null default 0,
  extras jsonb not null default '[]'::jsonb,
  duration_weeks numeric,
  valid_until date,
  reserves text not null default '',
  message text not null default '',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists offers_lot_idx on public.offers (lot_id);
-- Une seule offre par entreprise et par lot côté plateforme
create unique index if not exists offers_one_per_company
  on public.offers (lot_id, company_id) where source = 'platform';

-- ─── Évaluation interne (jamais visible des entreprises) ───────────────────
create table if not exists public.offer_reviews (
  offer_id uuid primary key references public.offers (id) on delete cascade,
  lot_id uuid not null references public.lots (id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  verdict text check (verdict in ('favori', 'negocier', 'ecarte')),
  updated_at timestamptz not null default now()
);

create table if not exists public.offer_comments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  lot_id uuid not null references public.lots (id) on delete cascade,
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists offer_comments_offer_idx on public.offer_comments (offer_id);

-- ─── Mise à jour automatique de updated_at ──────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'projects', 'lots', 'lot_private', 'offers', 'offer_reviews', 'sso_requests'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end;
$$;

-- Les entreprises qui avaient déjà une offre sur un lot gardent leur accès
insert into public.lot_access (lot_id, user_id, status, decided_at)
select distinct lot_id, company_id, 'approved', now() from public.offers
where source = 'platform' and company_id is not null
on conflict do nothing;

-- ─── Fonctions d'aide aux règles d'accès (évitent les récursions RLS) ───────
create or replace function public.is_project_owner(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = p_project and owner_id = auth.uid());
$$;

create or replace function public.is_project_member(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = p_project and user_id = auth.uid());
$$;

create or replace function public.lot_project(p_lot uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select project_id from public.lots where id = p_lot;
$$;

create or replace function public.is_lot_owner(p_lot uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_project_owner(public.lot_project(p_lot));
$$;

-- Entreprise acceptée sur un lot visible (publié ou suspendu)
create or replace function public.is_lot_member(p_lot uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lot_access a
    join public.lots l on l.id = a.lot_id
    join public.project_members m on m.project_id = l.project_id and m.user_id = a.user_id
    where a.lot_id = p_lot and a.user_id = auth.uid() and a.status = 'approved' and l.status <> 'draft');
$$;

create or replace function public.lot_published(p_lot uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lots where id = p_lot and status = 'published');
$$;

-- Liste des lots visibles d'un projet pour une entreprise membre : titre et échéance seulement,
-- jamais le DPGF tant que l'accès n'est pas accepté.
create or replace function public.project_lot_catalog(p_project uuid)
returns table (id uuid, name text, code text, due_date date, status text, line_count integer, access text)
language sql stable security definer set search_path = public as $$
  select l.id, l.name, l.code, l.due_date, l.status,
         (select count(*)::int from jsonb_array_elements(l.items) e where e->>'kind' = 'line'),
         (select a.status from public.lot_access a where a.lot_id = l.id and a.user_id = auth.uid())
  from public.lots l
  where l.project_id = p_project and l.status <> 'draft' and public.is_project_member(p_project)
  order by l.position, l.created_at;
$$;

-- Le lot accepte encore des offres (publié, date de rendu non dépassée, heure de Paris)
create or replace function public.lot_open(p_lot uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select status = 'published' and (due_date is null or due_date >= (now() at time zone 'Europe/Paris')::date)
            and not exists (select 1 from public.projects p where p.id = project_id and p.locked_at is not null)
       from public.lots where id = p_lot),
    false);
$$;

create or replace function public.offer_lot(p_offer uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select lot_id from public.offers where id = p_offer;
$$;

-- Un acheteur voit le profil des entreprises qui ont rejoint ses projets ;
-- une entreprise voit le profil de l'acheteur des projets qu'elle a rejoints.
create or replace function public.can_see_profile(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user = auth.uid()
    or exists (
      select 1 from public.project_members m
      join public.projects p on p.id = m.project_id
      where m.user_id = p_user and p.owner_id = auth.uid())
    or exists (
      select 1 from public.project_members m
      join public.projects p on p.id = m.project_id
      where p.owner_id = p_user and m.user_id = auth.uid());
$$;

-- Rejoindre un projet avec son code d'accès
create or replace function public.join_project(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project uuid;
begin
  if auth.uid() is null then
    raise exception 'Connectez-vous pour rejoindre un projet.';
  end if;
  select id into v_project from public.projects
  where access_code = upper(replace(trim(p_code), ' ', '')) and not is_example;
  if v_project is null then
    raise exception 'Code inconnu : vérifiez le code transmis par l''acheteur.';
  end if;
  if not public.is_project_owner(v_project) then
    insert into public.project_members (project_id, user_id) values (v_project, auth.uid())
    on conflict do nothing;
  end if;
  return v_project;
end;
$$;

-- ─── Relance d'une entreprise ───────────────────────────────────────────────
-- L'acheteur relance une entreprise acceptée sur un lot encore ouvert et qui n'a pas envoyé d'offre.
-- La relance est une alerte dans la cloche de l'entreprise, doublée d'un e-mail (texte fixe composé par
-- la fonction d'envoi). Une seule relance par entreprise et par lot toutes les 24 heures.
-- Renvoie 'sent', ou 'example' pour un projet exemple (entreprises fictives : rien n'est envoyé).
create or replace function public.remind_company(p_lot uuid, p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot public.lots;
  v_project public.projects;
  v_buyer public.profiles;
  v_company public.profiles;
begin
  select * into v_lot from public.lots where id = p_lot;
  if v_lot.id is null or not public.is_project_owner(v_lot.project_id) then
    raise exception 'reminder_forbidden';
  end if;
  select * into v_project from public.projects where id = v_lot.project_id;
  if not public.lot_open(p_lot) then
    raise exception 'reminder_closed';
  end if;
  if not exists (select 1 from public.lot_access where lot_id = p_lot and user_id = p_user and status = 'approved') then
    raise exception 'reminder_no_access';
  end if;
  if exists (select 1 from public.offers where lot_id = p_lot and company_id = p_user and status = 'submitted') then
    raise exception 'reminder_answered';
  end if;
  if v_project.is_example then
    return 'example';
  end if;
  if exists (select 1 from public.notifications
             where kind = 'offer_reminder' and lot_id = p_lot and user_id = p_user and created_at > now() - interval '24 hours') then
    raise exception 'reminder_recent';
  end if;
  select * into v_buyer from public.profiles where id = v_project.owner_id;
  select * into v_company from public.profiles where id = p_user;
  insert into public.notifications (user_id, kind, project_id, lot_id, actor_id, data)
  values (p_user, 'offer_reminder', v_project.id, v_lot.id, v_project.owner_id, jsonb_build_object(
    'project', v_project.name,
    'lot', v_lot.name,
    'company', coalesce(nullif(v_company.company_name, ''), trim(v_company.first_name || ' ' || v_company.last_name)),
    'buyer', coalesce(nullif(v_buyer.company_name, ''), 'L''acheteur'),
    'contact', trim(coalesce(v_buyer.first_name, '') || ' ' || coalesce(v_buyer.last_name, '')),
    'email', v_buyer.email,
    'due', to_char(v_lot.due_date, 'DD/MM/YYYY')
  ));
  return 'sent';
end;
$$;

-- Dernière relance par entreprise sur un lot (l'acheteur ne lit pas les alertes des entreprises)
create or replace function public.lot_reminders(p_lot uuid)
returns table (user_id uuid, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select n.user_id, max(n.created_at)
  from public.notifications n
  where n.kind = 'offer_reminder' and n.lot_id = p_lot and public.is_lot_owner(p_lot)
  group by n.user_id;
$$;

-- ─── Projet exemple ─────────────────────────────────────────────────────────
-- Un modèle unique (rempli par supabase/example.sql, généré depuis src/lib/example.ts) que chaque acheteur
-- peut copier dans son compte avec le bouton « Projet exemple ». Les entreprises du modèle ont des comptes
-- bloqués : personne ne peut s'y connecter. Les dates du modèle sont des décalages en jours, appliqués
-- au jour de la copie. Le modèle n'est lisible que par la fonction.
create table if not exists public.example_template (
  id integer primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.open_example_project()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_project uuid;
  v_lot uuid;
  t jsonb;
  l jsonb;
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour ouvrir le projet exemple.';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'buyer') then
    raise exception 'example_buyer_only';
  end if;
  -- Un seul exemple par acheteur, même si le bouton est cliqué deux fois de suite
  perform pg_advisory_xact_lock(hashtext('batimatch-example:' || v_uid::text));
  select id into v_project from public.projects where owner_id = v_uid and is_example order by created_at desc limit 1;
  if v_project is not null then
    return v_project;
  end if;
  select data into t from public.example_template where id = 1;
  if t is null then
    raise exception 'example_missing';
  end if;

  insert into public.projects (owner_id, name, reference, description, is_example)
  values (v_uid, t -> 'project' ->> 'name', t -> 'project' ->> 'reference', t -> 'project' ->> 'description', true)
  returning id into v_project;

  insert into public.project_members (project_id, user_id, joined_at)
  select v_project, (m ->> 'user_id')::uuid, v_now + make_interval(days => (m ->> 'joined')::int)
  from jsonb_array_elements(t -> 'members') m;

  -- Identifiants dérivés du projet : les liens entre offres, évaluations et attribution restent cohérents
  for l in select * from jsonb_array_elements(t -> 'lots') loop
    v_lot := md5(v_project::text || ':lot:' || (l ->> 'key'))::uuid;

    insert into public.lots (id, project_id, name, code, description, due_date, status, items, position, created_at, updated_at)
    values (v_lot, v_project, l ->> 'name', l ->> 'code', l ->> 'description', v_today + (l ->> 'due')::int,
            l ->> 'status', l -> 'items', (l ->> 'position')::int, v_now - interval '45 days', v_now - interval '45 days');

    insert into public.lot_private (lot_id, budget, budget_prices, settings, awarded_offer_id)
    values (v_lot, (l ->> 'budget')::numeric, l -> 'budget_prices', l -> 'settings',
            case when l ->> 'awarded' is not null then md5(v_project::text || ':offer:' || (l ->> 'awarded'))::uuid end);

    insert into public.lot_access (lot_id, user_id, status, requested_at, decided_at, comment)
    select v_lot, (a ->> 'user_id')::uuid, a ->> 'status', v_now + make_interval(days => (a ->> 'requested')::int),
           case when a ->> 'decided' is not null then v_now + make_interval(days => (a ->> 'decided')::int) end,
           a ->> 'comment'
    from jsonb_array_elements(l -> 'access') a;

    insert into public.offers (id, lot_id, company_id, source, status, version, company_name, contact_first_name,
                               contact_last_name, contact_email, contact_phone, logo_url, received_at, prices,
                               discount_pct, extras, duration_weeks, valid_until, reserves, message, submitted_at,
                               created_at, updated_at)
    select md5(v_project::text || ':offer:' || (o ->> 'key'))::uuid, v_lot, (o ->> 'company_id')::uuid, o ->> 'source',
           'submitted', (o ->> 'version')::int, o ->> 'company_name', o ->> 'contact_first_name', o ->> 'contact_last_name',
           o ->> 'contact_email', o ->> 'contact_phone', o ->> 'logo_url', v_today + (o ->> 'received')::int, o -> 'prices',
           coalesce((o ->> 'discount_pct')::numeric, 0), o -> 'extras', (o ->> 'duration_weeks')::numeric,
           case when o ->> 'valid' is not null then v_today + (o ->> 'valid')::int end,
           o ->> 'reserves', o ->> 'message',
           case when o ->> 'source' = 'platform' then v_now + make_interval(days => (o ->> 'received')::int) end,
           v_now + make_interval(days => (o ->> 'received')::int), v_now + make_interval(days => (o ->> 'received')::int)
    from jsonb_array_elements(l -> 'offers') o;

    insert into public.offer_reviews (offer_id, lot_id, scores, verdict)
    select md5(v_project::text || ':offer:' || (r ->> 'offer'))::uuid, v_lot, r -> 'scores', r ->> 'verdict'
    from jsonb_array_elements(l -> 'reviews') r;

    insert into public.offer_comments (offer_id, lot_id, author_id, body, created_at)
    select md5(v_project::text || ':offer:' || (c ->> 'offer'))::uuid, v_lot, v_uid, c ->> 'body',
           v_now + make_interval(days => (c ->> 'at')::int)
    from jsonb_array_elements(l -> 'comments') c;
  end loop;

  return v_project;
end;
$$;

-- ─── Copie et verrouillage d'un projet ──────────────────────────────────────
-- Verrouillé, un projet reste consultable mais plus rien ne s'y modifie : ni par l'acheteur, ni par les
-- entreprises. Le blocage est fait ici, dans la base (déclencheurs), pas seulement à l'écran.
-- Le code de déverrouillage est propre au projet ; seule son empreinte salée est conservée, dans une table
-- qu'aucun compte ne peut lire. Cinq codes faux bloquent les essais pendant 15 minutes.
create table if not exists public.project_locks (
  project_id uuid primary key references public.projects (id) on delete cascade,
  salt text not null,
  code_hash text not null,
  failed_count integer not null default 0,
  failed_at timestamptz,
  -- Code oublié : code à usage unique envoyé par e-mail (en clair seulement le temps de l'envoi)
  reset_hash text,
  reset_code text,
  reset_at timestamptz,
  reset_emailed_at timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.lock_hash(p_salt text, p_code text)
returns text language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(p_salt || ':' || p_code, 'UTF8')), 'hex');
$$;

create or replace function public.project_locked(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select locked_at is not null from public.projects where id = p_project), false);
$$;

-- Refuse toute écriture cliente dans un projet verrouillé (les opérations d'administration, sans compte
-- connecté, passent : suppression d'un utilisateur, maintenance).
create or replace function public.guard_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  j jsonb;
  v_locked boolean;
begin
  if auth.uid() is null or current_setting('batimatch.lock_bypass', true) = '1' then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then j := to_jsonb(old); else j := to_jsonb(new); end if;
  if tg_table_name = 'projects' then
    v_locked := tg_op <> 'INSERT' and old.locked_at is not null;
  elsif tg_table_name in ('lots', 'project_members') then
    v_locked := public.project_locked((j ->> 'project_id')::uuid);
  else
    v_locked := public.project_locked(public.lot_project((j ->> 'lot_id')::uuid));
  end if;
  if v_locked then
    raise exception 'project_locked';
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['projects', 'project_members', 'lots', 'lot_private', 'lot_access', 'offers', 'offer_reviews', 'offer_comments'] loop
    execute format('drop trigger if exists %I_locked on public.%I', t, t);
    execute format('create trigger %I_locked before insert or update or delete on public.%I for each row execute function public.guard_locked()', t, t);
  end loop;
end $$;

-- Verrouille un projet. Au premier verrouillage, le code est obligatoire (4 caractères au moins) ;
-- ensuite le même code reste valable et un simple appel suffit.
create or replace function public.lock_project(p_project uuid, p_code text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_salt text;
begin
  if not public.is_project_owner(p_project) then
    raise exception 'lock_forbidden';
  end if;
  if not exists (select 1 from public.project_locks where project_id = p_project) then
    if p_code is null or length(trim(p_code)) < 4 then
      raise exception 'lock_code_required';
    end if;
    v_salt := gen_random_uuid()::text;
    insert into public.project_locks (project_id, salt, code_hash) values (p_project, v_salt, public.lock_hash(v_salt, trim(p_code)));
  end if;
  perform set_config('batimatch.lock_bypass', '1', true);
  update public.projects set locked_at = now() where id = p_project and locked_at is null;
  perform set_config('batimatch.lock_bypass', '', true);
end;
$$;

-- Déverrouille avec le code : 'ok', 'wrong' (code faux) ou 'blocked' (trop d'essais, attendre 15 minutes)
create or replace function public.unlock_project(p_project uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.project_locks;
begin
  if not public.is_project_owner(p_project) then
    raise exception 'lock_forbidden';
  end if;
  select * into k from public.project_locks where project_id = p_project for update;
  if k.project_id is null then
    raise exception 'lock_missing';
  end if;
  if k.failed_count >= 5 and k.failed_at > now() - interval '15 minutes' then
    return 'blocked';
  end if;
  if public.lock_hash(k.salt, trim(coalesce(p_code, ''))) <> k.code_hash then
    update public.project_locks
       set failed_count = case when failed_at > now() - interval '15 minutes' then failed_count + 1 else 1 end, failed_at = now()
     where project_id = p_project;
    return 'wrong';
  end if;
  update public.project_locks set failed_count = 0, failed_at = null where project_id = p_project;
  perform set_config('batimatch.lock_bypass', '1', true);
  update public.projects set locked_at = null where id = p_project;
  perform set_config('batimatch.lock_bypass', '', true);
  return 'ok';
end;
$$;

-- Code oublié : envoie à l'acheteur, par e-mail, un code à 6 chiffres valable 30 minutes
create or replace function public.request_lock_reset(p_project uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := lpad((abs(('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::int) % 1000000)::text, 6, '0');
  v_salt text;
begin
  if not public.is_project_owner(p_project) then
    raise exception 'lock_forbidden';
  end if;
  select salt into v_salt from public.project_locks where project_id = p_project;
  if v_salt is null then
    raise exception 'lock_missing';
  end if;
  if exists (select 1 from public.project_locks where project_id = p_project and reset_at > now() - interval '2 minutes') then
    raise exception 'lock_reset_recent';
  end if;
  update public.project_locks
     set reset_hash = public.lock_hash(v_salt, v_code), reset_code = v_code, reset_at = now(), reset_emailed_at = null
   where project_id = p_project;
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    perform net.http_post(
      url := 'https://uhdanxctslncwwmcziba.supabase.co/functions/v1/notify-email',
      body := jsonb_build_object('lock_reset', p_project),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
end;
$$;

-- Avec le code reçu par e-mail : enregistre le nouveau code et déverrouille. 'ok', 'wrong', 'expired' ou 'blocked'.
create or replace function public.reset_lock_code(p_project uuid, p_reset text, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.project_locks;
  v_salt text;
begin
  if not public.is_project_owner(p_project) then
    raise exception 'lock_forbidden';
  end if;
  if p_code is null or length(trim(p_code)) < 4 then
    raise exception 'lock_code_required';
  end if;
  select * into k from public.project_locks where project_id = p_project for update;
  if k.project_id is null then
    raise exception 'lock_missing';
  end if;
  if k.failed_count >= 5 and k.failed_at > now() - interval '15 minutes' then
    return 'blocked';
  end if;
  if k.reset_hash is null or k.reset_at < now() - interval '30 minutes' then
    return 'expired';
  end if;
  if public.lock_hash(k.salt, trim(coalesce(p_reset, ''))) <> k.reset_hash then
    update public.project_locks
       set failed_count = case when failed_at > now() - interval '15 minutes' then failed_count + 1 else 1 end, failed_at = now()
     where project_id = p_project;
    return 'wrong';
  end if;
  v_salt := gen_random_uuid()::text;
  update public.project_locks
     set salt = v_salt, code_hash = public.lock_hash(v_salt, trim(p_code)), failed_count = 0, failed_at = null,
         reset_hash = null, reset_code = null, reset_at = null, updated_at = now()
   where project_id = p_project;
  perform set_config('batimatch.lock_bypass', '1', true);
  update public.projects set locked_at = null where id = p_project;
  perform set_config('batimatch.lock_bypass', '', true);
  return 'ok';
end;
$$;

-- Copie d'un projet pour l'acheteur : lots (repassés en brouillon), DPGF, budgets, offres remises (détachées
-- des comptes des entreprises), notes, commentaires et attribution. Les entreprises inscrites ne suivent pas.
create or replace function public.copy_project(p_project uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  src public.projects;
  v_new uuid;
begin
  if not public.is_project_owner(p_project) then
    raise exception 'copy_forbidden';
  end if;
  select * into src from public.projects where id = p_project;
  insert into public.projects (owner_id, name, reference, description)
  values (v_uid, left(src.name, 180) || ' (copie)', src.reference, src.description)
  returning id into v_new;

  insert into public.lots (id, project_id, name, code, description, due_date, status, items, position)
  select md5(v_new::text || ':' || l.id::text)::uuid, v_new, l.name, l.code, l.description, l.due_date, 'draft', l.items, l.position
  from public.lots l where l.project_id = p_project;

  insert into public.offers (id, lot_id, company_id, source, status, version, company_name, contact_first_name, contact_last_name,
                             contact_email, contact_phone, logo_url, received_at, prices, discount_pct, extras, duration_weeks,
                             valid_until, reserves, message, submitted_at)
  select md5(v_new::text || ':' || o.id::text)::uuid, md5(v_new::text || ':' || o.lot_id::text)::uuid, null, 'manual', 'submitted',
         o.version, o.company_name, o.contact_first_name, o.contact_last_name, o.contact_email, o.contact_phone, o.logo_url,
         o.received_at, o.prices, o.discount_pct, o.extras, o.duration_weeks, o.valid_until, o.reserves, o.message, null
  from public.offers o join public.lots l on l.id = o.lot_id
  where l.project_id = p_project and (o.status = 'submitted' or o.source = 'manual');

  insert into public.lot_private (lot_id, budget, budget_prices, settings, awarded_offer_id)
  select md5(v_new::text || ':' || lp.lot_id::text)::uuid, lp.budget, lp.budget_prices, lp.settings,
         case when exists (select 1 from public.offers o where o.id = lp.awarded_offer_id and (o.status = 'submitted' or o.source = 'manual'))
              then md5(v_new::text || ':' || lp.awarded_offer_id::text)::uuid end
  from public.lot_private lp join public.lots l on l.id = lp.lot_id
  where l.project_id = p_project
  on conflict (lot_id) do update set budget = excluded.budget, budget_prices = excluded.budget_prices,
                                      settings = excluded.settings, awarded_offer_id = excluded.awarded_offer_id;

  insert into public.offer_reviews (offer_id, lot_id, scores, verdict)
  select md5(v_new::text || ':' || r.offer_id::text)::uuid, md5(v_new::text || ':' || r.lot_id::text)::uuid, r.scores, r.verdict
  from public.offer_reviews r join public.lots l on l.id = r.lot_id
  where l.project_id = p_project and exists (select 1 from public.offers o where o.id = md5(v_new::text || ':' || r.offer_id::text)::uuid);

  insert into public.offer_comments (offer_id, lot_id, author_id, body, created_at)
  select md5(v_new::text || ':' || c.offer_id::text)::uuid, md5(v_new::text || ':' || c.lot_id::text)::uuid, v_uid, c.body, c.created_at
  from public.offer_comments c join public.lots l on l.id = c.lot_id
  where l.project_id = p_project and exists (select 1 from public.offers o where o.id = md5(v_new::text || ':' || c.offer_id::text)::uuid);

  return v_new;
end;
$$;

-- ─── Activation de la sécurité au niveau des lignes ─────────────────────────
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.lots enable row level security;
alter table public.lot_private enable row level security;
alter table public.lot_access enable row level security;
alter table public.notifications enable row level security;
alter table public.sso_requests enable row level security;
alter table public.sso_messages enable row level security;
alter table public.offers enable row level security;
alter table public.offer_reviews enable row level security;
alter table public.offer_comments enable row level security;
alter table public.project_locks enable row level security; -- aucune règle : lue seulement par les fonctions de verrouillage
alter table public.example_template enable row level security; -- aucune règle : lu seulement par open_example_project()

-- On repart de règles propres à chaque exécution
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'projects', 'project_members', 'lots', 'lot_private', 'lot_access', 'notifications', 'sso_requests', 'sso_messages', 'offers', 'offer_reviews', 'offer_comments')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end;
$$;

-- Profils
create policy profiles_select on public.profiles for select to authenticated
  using (public.can_see_profile(id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Projets
create policy projects_select on public.projects for select to authenticated
  using (owner_id = auth.uid() or public.is_project_member(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (owner_id = auth.uid());
create policy projects_update on public.projects for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy projects_delete on public.projects for delete to authenticated
  using (owner_id = auth.uid());

-- Membres (entreprises ayant rejoint un projet)
create policy members_select on public.project_members for select to authenticated
  using (user_id = auth.uid() or public.is_project_owner(project_id));
create policy members_delete on public.project_members for delete to authenticated
  using (user_id = auth.uid() or public.is_project_owner(project_id));

-- Lots : lisibles par l'acheteur et par les entreprises acceptées sur le lot, modifiables par l'acheteur
create policy lots_select on public.lots for select to authenticated
  using (public.is_project_owner(project_id) or public.is_lot_member(id));
create policy lots_insert on public.lots for insert to authenticated
  with check (public.is_project_owner(project_id));
create policy lots_update on public.lots for update to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
create policy lots_delete on public.lots for delete to authenticated
  using (public.is_project_owner(project_id));

-- Accès aux lots : l'entreprise dépose sa demande (toujours « en attente »), l'acheteur décide
create policy lot_access_select on public.lot_access for select to authenticated
  using (user_id = auth.uid() or public.is_lot_owner(lot_id));
create policy lot_access_insert on public.lot_access for insert to authenticated
  with check (
    user_id = auth.uid() and status = 'pending' and decided_at is null
    and public.is_project_member(public.lot_project(lot_id)) and public.lot_published(lot_id)
  );
create policy lot_access_update on public.lot_access for update to authenticated
  using (public.is_lot_owner(lot_id)) with check (public.is_lot_owner(lot_id));
-- L'entreprise peut ne pas répondre à un lot accessible (motif obligatoire), puis revenir sur sa décision
create policy lot_access_decline on public.lot_access for update to authenticated
  using (user_id = auth.uid() and status in ('approved', 'declined') and public.lot_open(lot_id))
  with check (
    user_id = auth.uid() and public.lot_open(lot_id)
    and (
      (status = 'declined' and char_length(trim(coalesce(comment, ''))) >= 3)
      or (status = 'approved' and comment is null)
    )
  );
create policy lot_access_delete on public.lot_access for delete to authenticated
  using (public.is_lot_owner(lot_id));

-- Notifications : chacun lit les siennes et peut seulement les marquer comme lues ou les effacer
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- Demandes SSO : réservées à l'administrateur. La création passe uniquement par request_sso().
create policy sso_requests_select on public.sso_requests for select to authenticated
  using (public.is_admin());
create policy sso_requests_update on public.sso_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy sso_requests_delete on public.sso_requests for delete to authenticated
  using (public.is_admin());
create policy sso_messages_select on public.sso_messages for select to authenticated
  using (public.is_admin());
create policy sso_messages_insert on public.sso_messages for insert to authenticated
  with check (public.is_admin() and kind = 'reply');

-- Données privées du lot : acheteur uniquement
create policy lot_private_all on public.lot_private for all to authenticated
  using (public.is_lot_owner(lot_id)) with check (public.is_lot_owner(lot_id));

-- Offres
create policy offers_select on public.offers for select to authenticated
  using (
    company_id = auth.uid()
    or (public.is_lot_owner(lot_id) and (status = 'submitted' or source = 'manual'))
  );
create policy offers_insert on public.offers for insert to authenticated
  with check (
    (source = 'platform' and company_id = auth.uid() and public.is_lot_member(lot_id) and public.lot_open(lot_id))
    or (source = 'manual' and company_id is null and public.is_lot_owner(lot_id))
  );
create policy offers_update on public.offers for update to authenticated
  using (
    (source = 'platform' and company_id = auth.uid() and public.lot_open(lot_id))
    or (source = 'manual' and public.is_lot_owner(lot_id))
  )
  with check (
    (source = 'platform' and company_id = auth.uid() and public.is_lot_member(lot_id) and public.lot_open(lot_id))
    or (source = 'manual' and company_id is null and public.is_lot_owner(lot_id))
  );
create policy offers_delete on public.offers for delete to authenticated
  using (
    (source = 'manual' and public.is_lot_owner(lot_id))
    or (source = 'platform' and company_id = auth.uid() and status = 'draft')
  );

-- Évaluation et commentaires internes : acheteur uniquement
create policy reviews_all on public.offer_reviews for all to authenticated
  using (public.is_lot_owner(lot_id))
  with check (public.is_lot_owner(lot_id) and public.offer_lot(offer_id) = lot_id);
create policy comments_select on public.offer_comments for select to authenticated
  using (public.is_lot_owner(lot_id));
create policy comments_insert on public.offer_comments for insert to authenticated
  with check (public.is_lot_owner(lot_id) and public.offer_lot(offer_id) = lot_id and author_id = auth.uid());
create policy comments_delete on public.offer_comments for delete to authenticated
  using (public.is_lot_owner(lot_id) and author_id = auth.uid());

-- ─── Droits d'accès de l'API ────────────────────────────────────────────────
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.projects, public.project_members, public.lots,
  public.lot_private, public.lot_access, public.offers, public.offer_reviews, public.offer_comments
  to authenticated;
revoke all on public.notifications from authenticated, anon;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke all on function public.notify_lot_access() from public, authenticated, anon;
revoke all on function public.notification_send_email() from public, authenticated, anon;
revoke all on public.sso_requests, public.sso_messages from authenticated, anon;
grant select, delete on public.sso_requests to authenticated;
grant update (status, admin_note) on public.sso_requests to authenticated;
grant select on public.sso_messages to authenticated;
grant insert (request_id, kind, subject, body) on public.sso_messages to authenticated;
revoke all on function public.admin_ids() from public, authenticated, anon;
revoke all on function public.sso_message_created() from public, authenticated, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.request_sso(text, text, text, text, text, text, text) from public;
grant usage on schema public to anon;
grant execute on function public.request_sso(text, text, text, text, text, text, text) to anon, authenticated;
revoke all on function public.join_project(text) from public;
grant execute on function public.join_project(text) to authenticated;
revoke all on public.project_locks from authenticated, anon;
revoke all on function public.lock_hash(text, text) from public, anon, authenticated;
revoke all on function public.guard_locked() from public, anon, authenticated;
revoke all on function public.lock_project(uuid, text) from public, anon;
grant execute on function public.lock_project(uuid, text) to authenticated;
revoke all on function public.unlock_project(uuid, text) from public, anon;
grant execute on function public.unlock_project(uuid, text) to authenticated;
revoke all on function public.request_lock_reset(uuid) from public, anon;
grant execute on function public.request_lock_reset(uuid) to authenticated;
revoke all on function public.reset_lock_code(uuid, text, text) from public, anon;
grant execute on function public.reset_lock_code(uuid, text, text) to authenticated;
revoke all on function public.copy_project(uuid) from public, anon;
grant execute on function public.copy_project(uuid) to authenticated;
revoke all on function public.remind_company(uuid, uuid) from public, anon;
grant execute on function public.remind_company(uuid, uuid) to authenticated;
revoke all on function public.lot_reminders(uuid) from public, anon;
grant execute on function public.lot_reminders(uuid) to authenticated;
revoke all on public.example_template from authenticated, anon;
revoke all on function public.open_example_project() from public, anon;
grant execute on function public.open_example_project() to authenticated;
revoke all on function public.project_lot_catalog(uuid) from public;
grant execute on function public.project_lot_catalog(uuid) to authenticated;

-- ─── Stockage des logos ─────────────────────────────────────────────────────
-- Dossier public « logos » ; chacun ne peut écrire que dans son propre sous-dossier.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists logos_read on storage.objects;
drop policy if exists logos_insert on storage.objects;
drop policy if exists logos_update on storage.objects;
drop policy if exists logos_delete on storage.objects;

create policy logos_read on storage.objects for select
  using (bucket_id = 'logos');
create policy logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy logos_update on storage.objects for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── Notice technique jointe à une offre (PDF facultatif) ───────────────────
-- offers.tech_note = { path, name, size, at } ; le fichier est dans le dossier privé « offer-files ».
-- Chemin : <lot>/<compte entreprise>/<offre>.pdf, ou <lot>/manual/<offre>.pdf pour une offre saisie par l'acheteur.
alter table public.offers add column if not exists tech_note jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('offer-files', 'offer-files', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Dépôt : l'entreprise acceptée sur un lot ouvert, dans son dossier ; l'acheteur pour ses offres manuelles
create or replace function public.offer_file_writable(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lots l
    where l.id::text = (storage.foldername(p_name))[1]
      and (
        ((storage.foldername(p_name))[2] = auth.uid()::text and public.is_lot_member(l.id) and public.lot_open(l.id))
        or ((storage.foldername(p_name))[2] = 'manual' and public.is_lot_owner(l.id))
      )
  );
$$;

-- Lecture : l'entreprise pour son dossier ; l'acheteur une fois l'offre envoyée
create or replace function public.offer_file_readable(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lots l
    where l.id::text = (storage.foldername(p_name))[1]
      and (
        (storage.foldername(p_name))[2] = auth.uid()::text
        or (
          public.is_lot_owner(l.id)
          and (
            (storage.foldername(p_name))[2] = 'manual'
            or exists (
              select 1 from public.offers o
              where o.lot_id = l.id and o.company_id::text = (storage.foldername(p_name))[2] and o.status = 'submitted'
            )
          )
        )
      )
  );
$$;
revoke all on function public.offer_file_writable(text) from public;
revoke all on function public.offer_file_readable(text) from public;
grant execute on function public.offer_file_writable(text) to authenticated;
grant execute on function public.offer_file_readable(text) to authenticated;

drop policy if exists offer_files_read on storage.objects;
drop policy if exists offer_files_insert on storage.objects;
drop policy if exists offer_files_update on storage.objects;
drop policy if exists offer_files_delete on storage.objects;

create policy offer_files_read on storage.objects for select to authenticated
  using (bucket_id = 'offer-files' and public.offer_file_readable(name));
create policy offer_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'offer-files' and public.offer_file_writable(name));
create policy offer_files_update on storage.objects for update to authenticated
  using (bucket_id = 'offer-files' and public.offer_file_writable(name))
  with check (bucket_id = 'offer-files' and public.offer_file_writable(name));
create policy offer_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'offer-files' and public.offer_file_writable(name));
