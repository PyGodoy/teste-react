/*
  # Add swimming times tracking

  1. New Tables
    - `swimming_times`
      - `id` (uuid, primary key)
      - `student_id` (uuid, references profiles)
      - `distance` (text, enum of distances)
      - `style` (text, enum of styles)
      - `time_seconds` (numeric, for precise time tracking)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `swimming_times` table
    - Add policies for students to manage their own times
    - Add policies for professors to view their students' times
*/

-- Create enums for distances and styles
CREATE TYPE swimming_distance AS ENUM (
  '50m',
  '100m',
  '200m',
  '400m',
  '800m',
  '1500m'
);

CREATE TYPE swimming_style AS ENUM (
  'crawl',
  'costas',
  'peito',
  'borboleta',
  'medley'
);

-- Create swimming times table
CREATE TABLE swimming_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES profiles(id) NOT NULL,
  distance swimming_distance NOT NULL,
  style swimming_style NOT NULL,
  time_seconds numeric(10, 3) NOT NULL, -- Store time in seconds for precise calculations
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE swimming_times ENABLE ROW LEVEL SECURITY;

-- Policies for swimming times
CREATE POLICY "Students can insert their own times"
  ON swimming_times
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can view their own times"
  ON swimming_times
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'professor'
    )
  );

CREATE POLICY "Students can update their own times"
  ON swimming_times
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can delete their own times"
  ON swimming_times
  FOR DELETE
  TO authenticated
  USING (auth.uid() = student_id);