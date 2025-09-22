/*
  # Create keywords table

  1. New Tables
    - `keywords`
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key to clients)
      - `keyword` (text, the keyword phrase)
      - `search_volume` (integer, monthly search volume)
      - `cpc` (numeric, cost per click)
      - `difficulty` (integer, keyword difficulty score)
      - `current_rank` (integer, current ranking position)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `keywords` table
    - Add policy for authenticated users to manage keywords
*/

CREATE TABLE IF NOT EXISTS keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  search_volume integer DEFAULT NULL,
  cpc numeric(10,2) DEFAULT NULL,
  difficulty integer DEFAULT NULL,
  current_rank integer DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage keywords"
  ON keywords
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update timestamp trigger
CREATE TRIGGER update_keywords_updated_at
  BEFORE UPDATE ON keywords
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Index for better performance
CREATE INDEX IF NOT EXISTS idx_keywords_client_id ON keywords(client_id);
CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON keywords(keyword);