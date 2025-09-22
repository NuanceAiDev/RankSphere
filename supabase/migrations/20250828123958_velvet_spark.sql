/*
  # Fix RLS policies for keywords table

  1. Security Updates
    - Drop existing restrictive policies on keywords table
    - Add permissive policies for anonymous and authenticated users
    - Allow INSERT, SELECT, UPDATE, DELETE operations for all users

  2. Changes
    - Enable proper access for keyword management
    - Ensure anonymous users can add keywords
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage keywords" ON keywords;
DROP POLICY IF EXISTS "Users can view keywords" ON keywords;
DROP POLICY IF EXISTS "Users can insert keywords" ON keywords;
DROP POLICY IF EXISTS "Users can update keywords" ON keywords;
DROP POLICY IF EXISTS "Users can delete keywords" ON keywords;

-- Create permissive policies for all operations
CREATE POLICY "Anonymous users can manage keywords"
  ON keywords
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage keywords"
  ON keywords
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);