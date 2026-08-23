-- Genvexa production auth and admin-user schema.
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  email text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'creator', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended', 'disabled')),
  auth_provider text not null default 'email',
  email_verified_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_role_idx on public.profiles (role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  provider text;
  display_name text;
  base_username text;
begin
  provider := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  display_name := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  base_username := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g'));
  if base_username = '' then base_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10); end if;
  if exists (select 1 from public.profiles where username = base_username and id <> new.id) then base_username := base_username || '_' || substr(replace(new.id::text, '-', ''), 1, 6); end if;
  insert into public.profiles (id, username, full_name, email, auth_provider, email_verified_at)
  values (new.id, base_username, display_name, new.email, provider, new.email_confirmed_at)
  on conflict (id) do update set email = excluded.email, auth_provider = excluded.auth_provider, email_verified_at = excluded.email_verified_at;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_status()
returns text
language sql
stable
security definer set search_path = public
as $$
  select status from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.current_user_role() = 'admin' and public.current_user_status() = 'active';
$$;

alter table public.profiles enable row level security;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = public.current_user_role() and status = public.current_user_status());
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  success boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists admin_audit_created_at_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_target_idx on public.admin_audit_log (target_user_id);
alter table public.admin_audit_log enable row level security;
drop policy if exists audit_admin_read on public.admin_audit_log;
create policy audit_admin_read on public.admin_audit_log for select using (public.is_admin());

-- After creating your first account, promote it from a trusted SQL session:
-- update public.profiles set role = 'admin' where email = 'your-admin-email@example.com';
