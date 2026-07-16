/*
  # RankSphere Schema Rebuild

  1. New Tables
    - `clients_new`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `domain` (text, not null)
      - `industry` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `keywords_new`
      - `id` (uuid, primary key)
      - `text` (text, not null)
      - `previous_month_rank` (integer, nullable)
      - `previous_month_date` (date, nullable)
      - `current_month_rank` (integer, nullable)
      - `current_month_date` (date, nullable)
      - `client_id` (uuid, foreign key)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for anonymous and authenticated users to manage all data

  3. Migration Strategy
    - Create new tables with correct schema
    - Migrate existing data if any
    - Drop old tables
    - Rename new tables to final names
*/

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create new clients table
CREATE TABLE IF NOT EXISTS clients_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text NOT NULL,
  industry text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create new keywords table
CREATE TABLE IF NOT EXISTS keywords_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  previous_month_rank integer,
  previous_month_date date,
  current_month_rank integer,
  current_month_date date,
  client_id uuid NOT NULL REFERENCES clients_new(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Migrate existing data if tables exist
DO $$
BEGIN
  -- Migrate clients data
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clients') THEN
    INSERT INTO clients_new (id, name, domain, created_at, updated_at)
    SELECT id, name, domain, created_at, updated_at FROM clients
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Migrate keywords data (transform old schema to new)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'keywords') THEN
    INSERT INTO keywords_new (id, text, current_month_rank, current_month_date, client_id, created_at, updated_at)
    SELECT 
      id, 
      keyword as text, 
      current_rank as current_month_rank,
      CASE WHEN last_checked IS NOT NULL THEN last_checked::date ELSE CURRENT_DATE END as current_month_date,
      client_id, 
      created_at, 
      updated_at 
    FROM keywords
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Drop old tables if they exist
DROP TABLE IF EXISTS ranking_history CASCADE;
DROP TABLE IF EXISTS keywords CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- Rename new tables to final names
ALTER TABLE IF EXISTS clients_new RENAME TO clients;
ALTER TABLE IF EXISTS keywords_new RENAME TO keywords;

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;

-- Create permissive RLS policies
CREATE POLICY "Allow all operations for anonymous users"
  ON clients
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users"
  ON clients
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for anonymous users"
  ON keywords
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users"
  ON keywords
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_keywords_client_id ON keywords(client_id);
CREATE INDEX IF NOT EXISTS idx_keywords_text ON keywords(text);
CREATE INDEX IF NOT EXISTS idx_keywords_current_month_date ON keywords(current_month_date);

-- Create updated_at triggers
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_keywords_updated_at
  BEFORE UPDATE ON keywords
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();