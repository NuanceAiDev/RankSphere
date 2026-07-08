/*
  # Add SELECT policy for analytics_screenshots so remove() works

  Screenshot deletes were still blocked after granting DELETE (20260708120000).
  Root cause: supabase.storage.remove() is gated by RLS in TWO steps —
    1. SELECT storage.objects to locate the rows matching the given paths
    2. DELETE those rows and return them
  With only a DELETE policy, step 1 finds zero rows (SELECT denied), so nothing is
  deleted and the API returns an empty array with no error — which the frontend
  reports as a blocked delete.

  This adds the missing SELECT policy and re-asserts DELETE, both scoped to the
  `public` role (covers anon + authenticated) and restricted to this single bucket.

  Note: image display works via public-URL reads (bucket is public) and .list()
  works via a SECURITY DEFINER search function, so neither exercised this SELECT
  policy — only remove() does.

  Idempotent (DROP POLICY IF EXISTS before CREATE), safe to re-run.

  APPLYING: policies on storage.objects must be created by the table owner
  (supabase_storage_admin). If `supabase db push` cannot create them under the
  migration role, run the same statements in the Supabase Dashboard -> SQL Editor.
*/

-- SELECT — lets remove() locate the objects (the previously missing piece).
DROP POLICY IF EXISTS "Anyone can read analytics screenshots" ON storage.objects;
CREATE POLICY "Anyone can read analytics screenshots"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'analytics_screenshots');

-- DELETE — re-asserted so both required policies are guaranteed present together.
DROP POLICY IF EXISTS "Anyone can delete analytics screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete analytics screenshots" ON storage.objects;
CREATE POLICY "Anyone can delete analytics screenshots"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'analytics_screenshots');
