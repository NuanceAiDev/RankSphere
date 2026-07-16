/*
  # Add last_checked column to keywords table

  1. Changes
    - Add `last_checked` column to `keywords` table to track when keyword data was last fetched
    - Set default value to NULL for existing records
    - Add index for performance on last_checked queries

  2. Security
    - No changes to existing RLS policies
*/

-- Add last_checked column to keywords table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'keywords' AND column_name = 'last_checked'
  ) THEN
    ALTER TABLE keywords ADD COLUMN last_checked timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Add index for performance on last_checked queries
CREATE INDEX IF NOT EXISTS idx_keywords_last_checked ON keywords(last_checked);