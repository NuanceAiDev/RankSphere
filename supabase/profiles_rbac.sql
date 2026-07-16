-- ============================================================
-- profiles table + auto-create trigger for RBAC
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create the profiles table linked to auth.users
create table if not exists public.profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  role      text not null default 'viewer',
  created_at timestamptz not null default now()
);

-- 2. Enable Row Level Security
alter table public.profiles enable row level security;

-- 3. RLS policy: users can read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- 4. RLS policy: only the service role (server) can insert/update
create policy "Service role can manage profiles"
  on public.profiles for all
  using (auth.role() = 'service_role');

-- 5. Function: auto-insert a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 6. Trigger: fire the function after each new auth.users row
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- After running: go to Table Editor → profiles
-- Find your user row and manually set role = 'admin'
-- ============================================================
