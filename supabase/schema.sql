create extension if not exists pgcrypto;

create table if not exists public.compass_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.compass_projects (
  slug text primary key,
  name text not null,
  neighborhood text not null default '',
  status text not null check (status in ('delivered', 'under_construction')),
  summary text not null default '',
  display_order integer not null default 0,
  is_published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.compass_assets (
  id uuid primary key default gen_random_uuid(),
  project_slug text not null references public.compass_projects (slug) on update cascade on delete cascade,
  kind text not null check (kind in ('project_render', 'tour_1br', 'tour_2br', 'tour_3br', 'construction_update', 'floor_plan')),
  title text not null,
  alt_text text not null default '',
  storage_path text not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.compass_contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  email text not null check (length(trim(email)) between 3 and 254),
  phone text not null default '' check (length(phone) <= 40),
  project text not null default '' check (length(project) <= 100),
  message text not null check (length(trim(message)) between 10 and 3000),
  created_at timestamptz not null default now()
);

create index if not exists compass_assets_project_kind_idx
  on public.compass_assets (project_slug, kind, created_at desc);

create index if not exists compass_contact_messages_created_at_idx
  on public.compass_contact_messages (created_at desc);

create or replace function public.is_compass_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.compass_admins
    where user_id = (select auth.uid())
  );
$$;

grant execute on function public.is_compass_admin() to anon, authenticated;
grant select on public.compass_admins to authenticated;
grant select on public.compass_projects to anon, authenticated;
grant insert, update, delete on public.compass_projects to authenticated;
grant select on public.compass_assets to anon, authenticated;
grant insert, update, delete on public.compass_assets to authenticated;
grant insert on public.compass_contact_messages to anon, authenticated;
grant select on public.compass_contact_messages to authenticated;

alter table public.compass_admins enable row level security;
alter table public.compass_projects enable row level security;
alter table public.compass_assets enable row level security;
alter table public.compass_contact_messages enable row level security;

drop policy if exists "Compass admins can read their own membership" on public.compass_admins;
create policy "Compass admins can read their own membership"
  on public.compass_admins for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Published Compass projects are public" on public.compass_projects;
create policy "Published Compass projects are public"
  on public.compass_projects for select to anon, authenticated
  using (is_published or (select public.is_compass_admin()));

drop policy if exists "Compass admins manage projects" on public.compass_projects;
create policy "Compass admins manage projects"
  on public.compass_projects for all to authenticated
  using ((select public.is_compass_admin()))
  with check ((select public.is_compass_admin()));

drop policy if exists "Published Compass assets are public" on public.compass_assets;
create policy "Published Compass assets are public"
  on public.compass_assets for select to anon, authenticated
  using (
    (is_public and exists (
      select 1 from public.compass_projects
      where compass_projects.slug = compass_assets.project_slug
        and compass_projects.is_published
    ))
    or (select public.is_compass_admin())
  );

drop policy if exists "Compass admins manage assets" on public.compass_assets;
create policy "Compass admins manage assets"
  on public.compass_assets for all to authenticated
  using ((select public.is_compass_admin()))
  with check ((select public.is_compass_admin()));

drop policy if exists "Visitors can send Compass messages" on public.compass_contact_messages;
create policy "Visitors can send Compass messages"
  on public.compass_contact_messages for insert to anon, authenticated
  with check (true);

drop policy if exists "Compass admins can read contact messages" on public.compass_contact_messages;
create policy "Compass admins can read contact messages"
  on public.compass_contact_messages for select to authenticated
  using ((select public.is_compass_admin()));

insert into public.compass_projects (slug, name, neighborhood, status, summary, display_order)
values
  ('meskel-flower', 'Meskel Flower', 'Meskel Flower', 'delivered', 'Delivered development in Meskel Flower, Addis Ababa.', 1),
  ('kera', 'Kera', 'Kera', 'delivered', 'Delivered development in Kera, Addis Ababa.', 2),
  ('kazanchis', 'Kazanchis', 'Kazanchis', 'under_construction', 'Apartments and shops under construction in Kazanchis.', 3),
  ('bole-atlas', 'Bole Atlas', 'Bole Atlas', 'under_construction', 'Apartment development under construction in Bole Atlas.', 4)
on conflict (slug) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'compass-media',
  'compass-media',
  true,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "Compass media is publicly viewable" on storage.objects;
create policy "Compass media is publicly viewable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'compass-media');

drop policy if exists "Compass admins upload media" on storage.objects;
create policy "Compass admins upload media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'compass-media' and (select public.is_compass_admin()));

drop policy if exists "Compass admins update media" on storage.objects;
create policy "Compass admins update media"
  on storage.objects for update to authenticated
  using (bucket_id = 'compass-media' and (select public.is_compass_admin()))
  with check (bucket_id = 'compass-media' and (select public.is_compass_admin()));

drop policy if exists "Compass admins delete media" on storage.objects;
create policy "Compass admins delete media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'compass-media' and (select public.is_compass_admin()));

-- Create/invite the owner in Supabase Auth, then replace the email below and run:
-- insert into public.compass_admins (user_id)
-- select id from auth.users where email = 'owner@example.com'
-- on conflict (user_id) do nothing;
