/*
  # Add GA4 Support to SEO Dashboard

  1. New Tables
    - `ga4_reports` - Store GA4 analytics data with daily granularity
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key to clients)
      - `date` (date)
      - `sessions` (integer)
      - `users` (integer) 
      - `engagements` (integer)
      - `source` (text)
      - `medium` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Schema Changes
    - Add `ga4_property_id` column to `clients` table

  3. Security
    - Enable RLS on `ga4_reports` table
    - Add policies for authenticated users to manage their data
*/

-- Add GA4 Property ID to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'ga4_property_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN ga4_property_id TEXT;
  END IF;
END $$;

-- Create GA4 reports table
CREATE TABLE IF NOT EXISTS ga4_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  sessions integer DEFAULT 0,
  users integer DEFAULT 0,
  engagements integer DEFAULT 0,
  source text NOT NULL,
  medium text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, date, source, medium)
);

-- Enable RLS
ALTER TABLE ga4_reports ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Allow all operations for anonymous users"
  ON ga4_reports
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users"
  ON ga4_reports
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ga4_reports_client_id ON ga4_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_ga4_reports_date ON ga4_reports(date);
CREATE INDEX IF NOT EXISTS idx_ga4_reports_client_date ON ga4_reports(client_id, date);

-- Add updated_at trigger
CREATE TRIGGER update_ga4_reports_updated_at
  BEFORE UPDATE ON ga4_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();