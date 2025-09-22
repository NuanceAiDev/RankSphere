/*
  # Add rank type preference to clients

  1. New Columns
    - `rank_type` (text, default 'qatar')
      - Stores client's preferred rank type: 'organic' or 'qatar'
      - Defaults to 'qatar' for all clients

  2. Changes
    - Add rank_type column to existing clients table
    - Set default value to 'qatar'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'rank_type'
  ) THEN
    ALTER TABLE clients ADD COLUMN rank_type text DEFAULT 'qatar';
  END IF;
END $$;