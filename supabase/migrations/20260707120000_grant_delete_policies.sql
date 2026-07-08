/*
  # Grant DELETE access for keywords and analytics_screenshots

  Fixes the "delete succeeds in the UI but reappears on refresh" bug. That symptom
  is caused by an RLS policy silently discarding the DELETE: PostgREST returns
  HTTP 200 with 0 rows affected and no error, so the client falsely reports success.

  1. keywords table
     - Re-assert an explicit DELETE policy for authenticated (and anon) roles.
     - Idempotent: drops the policy first so re-running this migration is safe and
       repairs any drift where the deployed policy diverged from the repo.

  2. storage.objects (analytics_screenshots bucket)
     - Storage bucket policies are not part of the committed migrations (they are
       normally set in the Supabase dashboard), which is why screenshot deletes were
       being blocked for both Admin and Viewer.
     - Grant DELETE on objects in the `analytics_screenshots` bucket to authenticated
       users. Scoped by bucket_id so no other bucket is affected.

  Notes
    - RLS is already enabled on `keywords` and on `storage.objects` (Supabase default),
      so this migration only manages policies.
    - Uses DROP POLICY IF EXISTS + CREATE POLICY for full idempotency.
*/

-- ---------------------------------------------------------------------------
-- 1. keywords — re-assert DELETE access
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can delete keywords" ON keywords;
CREATE POLICY "Authenticated users can delete keywords"
  ON keywords
  FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anonymous users can delete keywords" ON keywords;
CREATE POLICY "Anonymous users can delete keywords"
  ON keywords
  FOR DELETE
  TO anon
  USING (true);

-- ---------------------------------------------------------------------------
-- 2. analytics_screenshots bucket — grant DELETE on its storage objects
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can delete analytics screenshots" ON storage.objects;
CREATE POLICY "Authenticated users can delete analytics screenshots"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'analytics_screenshots');
