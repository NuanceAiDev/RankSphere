/*
  # Add last_checked column to keywords table

  1. Schema Changes
    - Add `last_checked` column to `keywords` table
    - Column stores timestamp of when keyword ranking was last fetched
    - Allows tracking data freshness and API usage optimization

  2. Data Migration
    - Column is nullable to handle existing keywords
    - New keywords will have null until first fetch
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'keywords' AND column_name = 'last_checked'
  ) THEN
    ALTER TABLE keywords ADD COLUMN last_checked timestamptz;
  END IF;
END $$;