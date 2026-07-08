/*
  # Fix analytics_screenshots DELETE policy (broaden role scope)

  The previous migration (20260707120000_grant_delete_policies.sql) created the
  storage DELETE policy with `TO authenticated`. Screenshot deletes are still being
  blocked, so this migration widens the policy to the `public` role.

  Why `public`:
    - `public` is the parent Postgres role that BOTH `anon` and `authenticated`
      inherit from. Granting the policy `TO public` makes it apply regardless of how
      Supabase resolves the request's role, eliminating role scope as a failure cause.
    - Scope is still restricted to this single bucket via `bucket_id`, so no other
      bucket's objects are affected.

  Idempotent: drops the old authenticated-scoped policy and this policy before
  (re)creating, so the migration is safe to run more than once.

  NOTE ON APPLYING: policies on `storage.objects` must be created by the table owner
  (supabase_storage_admin). If `supabase db push` cannot create it under the migration
  role, run this same SQL in the Supabase Dashboard -> SQL Editor, which executes with
  the required privileges.
*/

-- Remove the previous authenticated-only policy (from 20260707120000), if present.
DROP POLICY IF EXISTS "Authenticated users can delete analytics screenshots" ON storage.objects;

-- (Re)create the DELETE policy scoped to the public role, limited to this one bucket.
DROP POLICY IF EXISTS "Anyone can delete analytics screenshots" ON storage.objects;
CREATE POLICY "Anyone can delete analytics screenshots"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'analytics_screenshots');
