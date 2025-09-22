/*
  # Create ranking history table

  1. New Tables
    - `ranking_history`
      - `id` (uuid, primary key)
      - `keyword_id` (uuid, foreign key to keywords)
      - `rank` (integer, ranking position)
      - `date` (date, ranking date)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `ranking_history` table
    - Add policy for authenticated users to view ranking history
*/

CREATE TABLE IF NOT EXISTS ranking_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  rank integer NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ranking_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ranking history"
  ON ranking_history
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ranking_history_keyword_id ON ranking_history(keyword_id);
CREATE INDEX IF NOT EXISTS idx_ranking_history_date ON ranking_history(date);

-- Unique constraint to prevent duplicate entries for same keyword on same date
CREATE UNIQUE INDEX IF NOT EXISTS idx_ranking_history_unique 
ON ranking_history(keyword_id, date);