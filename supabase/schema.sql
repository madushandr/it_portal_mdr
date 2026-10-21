-- HPL Portal data model for Cloudflare Pages + Supabase + private Google Drive files.
-- Run once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

-- PROFILE TABLE: connects each Supabase Auth account to its portal username and module permissions.
create table if not exists public.portal_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text not null,
  is_admin boolean not null default false,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RECORD TABLE: stores each module entry as JSON so different modules can have different fields.
create table if not exists public.portal_records (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  data jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_records_module_not_empty check (length(trim(module)) > 0)
);

create index if not exists portal_records_module_updated_idx on public.portal_records(module, updated_at desc);
create index if not exists portal_records_created_by_idx on public.portal_records(created_by);

-- FILE METADATA: Google Drive keeps the private file; this table stores its portal link and details.
create table if not exists public.portal_files (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.portal_records(id) on delete cascade,
  module text not null,
  drive_file_id text not null unique,
  original_name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists portal_files_record_idx on public.portal_files(record_id, created_at desc);
create index if not exists portal_files_module_idx on public.portal_files(module);

-- AUDIT TABLE: records who changed which portal module and when.
create table if not exists public.portal_activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  module text not null,
  action text not null,
  record_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists portal_activity_created_idx on public.portal_activity_log(created_at desc);

-- PERMISSION HELPER: returns true for administrators or profiles with the requested module permission.
create or replace function public.portal_can_access(p_module text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.portal_profiles p
    where p.id = auth.uid()
      and (
        p.is_admin
        or coalesce((p.permissions -> p_module -> p_action) = 'true'::jsonb, false)
      )
  );
$$;

revoke all on function public.portal_can_access(text, text) from public;
grant execute on function public.portal_can_access(text, text) to authenticated;

-- UPDATED-AT TRIGGER FUNCTION: refreshes updated_at whenever a profile or record is changed.
create or replace function public.portal_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portal_profiles_touch_updated_at on public.portal_profiles;
create trigger portal_profiles_touch_updated_at
before update on public.portal_profiles
for each row execute function public.portal_touch_updated_at();

drop trigger if exists portal_records_touch_updated_at on public.portal_records;
create trigger portal_records_touch_updated_at
before update on public.portal_records
for each row execute function public.portal_touch_updated_at();

-- AUDIT TRIGGER FUNCTION: creates an activity entry after any portal record insert, update, or delete.
create or replace function public.portal_record_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_module text;
  v_id uuid;
  v_data jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'CREATE'; v_module := new.module; v_id := new.id; v_data := new.data;
  elsif tg_op = 'UPDATE' then
    v_action := 'UPDATE'; v_module := new.module; v_id := new.id; v_data := new.data;
  else
    v_action := 'DELETE'; v_module := old.module; v_id := old.id; v_data := old.data;
  end if;
  insert into public.portal_activity_log(actor_id, module, action, record_id, details)
  values (
    auth.uid(), v_module, v_action, v_id,
    jsonb_build_object('field_names', (select jsonb_agg(k) from jsonb_object_keys(v_data) as k))
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists portal_records_audit on public.portal_records;
create trigger portal_records_audit
after insert or update or delete on public.portal_records
for each row execute function public.portal_record_audit();

-- ROW-LEVEL SECURITY: enable policies before granting authenticated users access to portal data.
alter table public.portal_profiles enable row level security;
alter table public.portal_records enable row level security;
alter table public.portal_files enable row level security;
alter table public.portal_activity_log enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.portal_profiles to authenticated;
grant select, insert, update, delete on public.portal_records to authenticated;
grant select, insert, delete on public.portal_files to authenticated;
grant select on public.portal_activity_log to authenticated;
grant usage, select on sequence public.portal_activity_log_id_seq to authenticated;

-- PROFILE POLICIES: users can read their own profile; approved user managers can manage staff profiles.
drop policy if exists "profiles read own or admin" on public.portal_profiles;
create policy "profiles read own or admin"
on public.portal_profiles for select to authenticated
using (id = auth.uid() or public.portal_can_access('user_management', 'view'));

drop policy if exists "admins create profiles" on public.portal_profiles;
create policy "admins create profiles"
on public.portal_profiles for insert to authenticated
with check (public.portal_can_access('user_management', 'edit'));

drop policy if exists "admins update profiles" on public.portal_profiles;
create policy "admins update profiles"
on public.portal_profiles for update to authenticated
using (public.portal_can_access('user_management', 'edit'))
with check (public.portal_can_access('user_management', 'edit'));

drop policy if exists "admins delete profiles" on public.portal_profiles;
create policy "admins delete profiles"
on public.portal_profiles for delete to authenticated
using (public.portal_can_access('user_management', 'edit'));

-- RECORD POLICIES: module view permission controls reading; module edit permission controls changes.
drop policy if exists "records view by module permission" on public.portal_records;
create policy "records view by module permission"
on public.portal_records for select to authenticated
using (public.portal_can_access(module, 'view'));

drop policy if exists "records insert by module permission" on public.portal_records;
create policy "records insert by module permission"
on public.portal_records for insert to authenticated
with check (public.portal_can_access(module, 'edit'));

drop policy if exists "records update by module permission" on public.portal_records;
create policy "records update by module permission"
on public.portal_records for update to authenticated
using (public.portal_can_access(module, 'edit'))
with check (public.portal_can_access(module, 'edit'));

drop policy if exists "records delete by module permission" on public.portal_records;
create policy "records delete by module permission"
on public.portal_records for delete to authenticated
using (public.portal_can_access(module, 'edit'));

-- FILE POLICIES: file metadata is visible only when its record's module is available to the user.
drop policy if exists "files view by module permission" on public.portal_files;
create policy "files view by module permission"
on public.portal_files for select to authenticated
using (
  public.portal_can_access(module, 'view')
  and exists (
    select 1 from public.portal_records r
    where r.id = record_id and r.module = portal_files.module
  )
);

drop policy if exists "files insert by module permission" on public.portal_files;
create policy "files insert by module permission"
on public.portal_files for insert to authenticated
with check (
  public.portal_can_access(module, 'edit')
  and exists (
    select 1 from public.portal_records r
    where r.id = record_id and r.module = portal_files.module
  )
);

drop policy if exists "files delete by module permission" on public.portal_files;
create policy "files delete by module permission"
on public.portal_files for delete to authenticated
using (
  public.portal_can_access(module, 'edit')
  and exists (
    select 1 from public.portal_records r
    where r.id = record_id and r.module = portal_files.module
  )
);

-- AUDIT POLICY: the audit log is readable only by profiles granted activity_log view access.
drop policy if exists "activity log view by permission" on public.portal_activity_log;
create policy "activity log view by permission"
on public.portal_activity_log for select to authenticated
using (public.portal_can_access('activity_log', 'view'));

revoke all on public.portal_profiles from anon;
revoke all on public.portal_records from anon;
revoke all on public.portal_files from anon;
revoke all on public.portal_activity_log from anon;

-- The first administrator's profile is created after creating a Supabase Auth user.
-- Example (replace the UUID and email-derived username):
-- insert into public.portal_profiles(id, username, full_name, is_admin, permissions)
-- values ('AUTH-USER-UUID', 'admin', 'Portal Administrator', true, '{}'::jsonb);
