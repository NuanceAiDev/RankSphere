-- ============================================================
-- Add full_name to profiles + update trigger
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add the full_name column (safe to run even if it already exists)
alter table public.profiles
  add column if not exists full_name text not null default '';

-- 2. Replace the trigger function to also write full_name from auth metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'viewer',
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ============================================================
-- Trigger already exists from profiles_rbac.sql — no need to
-- recreate it; the function replacement above takes effect
-- immediately for all new signups.
-- ============================================================
