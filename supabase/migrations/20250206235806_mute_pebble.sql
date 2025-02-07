/*
  # Add status column to classes table

  1. Changes:
    - Add status column to classes table with default value 'active'
    - Update existing rows to have 'active' status
    - Add check constraint to ensure valid status values

  2. Security:
    - No changes to RLS policies needed
*/

-- Add status column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'classes' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE classes 
    ADD COLUMN status text NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'cancelled'));
  END IF;
END $$;

-- Update any existing rows to have 'active' status
UPDATE classes 
SET status = 'active' 
WHERE status IS NULL;