/*
  # Fix report_done_month column schema cache issue

  1. Schema Changes
    - Ensure `report_done_month` column exists in `clients` table
    - Add column if missing to fix schema cache issues
    - Column stores month-year string (MM-YYYY format) when report was marked done

  2. Data Migration
    - Column is nullable to handle existing clients
    - Uses IF NOT EXISTS to prevent errors if column already exists
*/

-- Ensure the report_done_month column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'report_done_month'
  ) THEN
    ALTER TABLE clients ADD COLUMN report_done_month TEXT;
  END IF;
END $$;

-- Refresh schema cache by updating table comment
COMMENT ON TABLE clients IS 'Client information with report tracking - updated ' || NOW();