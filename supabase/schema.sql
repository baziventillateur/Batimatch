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
  foreach t in array array['profiles', 'projects', 'lots', 'lot_private', 'offers', 'offer_reviews'] loop
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
  select id into v_project from public.projects where access_code = upper(replace(trim(p_code), ' ', ''));
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

-- ─── Activation de la sécurité au niveau des lignes ─────────────────────────
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.lots enable row level security;
alter table public.lot_private enable row level security;
alter table public.lot_access enable row level security;
alter table public.offers enable row level security;
alter table public.offer_reviews enable row level security;
alter table public.offer_comments enable row level security;

-- On repart de règles propres à chaque exécution
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'projects', 'project_members', 'lots', 'lot_private', 'lot_access', 'offers', 'offer_reviews', 'offer_comments')
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
revoke all on function public.join_project(text) from public;
grant execute on function public.join_project(text) to authenticated;
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
