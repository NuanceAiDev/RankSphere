/*
  # Create clients table with proper RLS policies

  1. New Tables
    - `clients`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `domain` (text, not null)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `clients` table
    - Add policy for authenticated users to manage all client data
    - Add policy for anonymous users to manage all client data (for development)

  3. Triggers
    - Auto-update `updated_at` timestamp on row changes
*/

-- Create the update function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can manage all clients"
  ON clients
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for anonymous users (for development)
CREATE POLICY "Anonymous users can manage all clients"
  ON clients
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();