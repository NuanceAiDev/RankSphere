/*
  # Add last_report_date to clients table

  1. Schema Changes
    - Add `last_report_date` column to `clients` table
    - Column stores timestamp of when the last report was generated
    - Allows tracking report generation status for filtering

  2. Data Migration
    - Column is nullable to handle existing clients
    - New reports will update this field automatically
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'last_report_date'
  ) THEN
    ALTER TABLE clients ADD COLUMN last_report_date timestamptz;
  END IF;
END $$;