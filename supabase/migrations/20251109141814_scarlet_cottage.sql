/*
  # Add report_done_month field to clients table

  1. Schema Changes
    - Add `report_done_month` column to `clients` table
    - Column stores month-year string (MM-YYYY format) when report was marked done
    - Allows manual tracking of report completion status

  2. Data Migration
    - Column is nullable to handle existing clients
    - New reports will be marked done manually by users
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'report_done_month'
  ) THEN
    ALTER TABLE clients ADD COLUMN report_done_month TEXT;
  END IF;
END $$;