-- Migration: Granular Visibility Control
-- Date: 2026-01-06
-- Description: Adds visibility columns for psychologist/psychiatrist and updates RLS.
-- Safety: Uses IF NOT EXISTS to prevent errors on repeated runs.

-- 1. Add Columns (Safe Add)
ALTER TABLE entries ADD COLUMN IF NOT EXISTS visible_to_psychologist boolean DEFAULT NULL;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS visible_to_psychiatrist boolean DEFAULT NULL;

-- 2. Update RLS Policy
-- Drop first to ensure we can recreate with new logic
DROP POLICY IF EXISTS "Doctors can view unlocked patient entries" ON entries;

CREATE POLICY "Doctors can view unlocked patient entries" ON entries
FOR SELECT
USING (
  is_locked = false
  AND EXISTS (
    SELECT 1 FROM doctor_patients
    WHERE doctor_patients.doctor_id = auth.uid()
    AND doctor_patients.patient_id = entries.user_id
  )
  AND (
    (
      -- Check if user is Psychologist
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.role = 'PSICOLOGO' OR profiles.clinical_role = 'PSICOLOGO')
      )
      AND (visible_to_psychologist IS TRUE OR visible_to_psychologist IS NULL)
    )
    OR
    (
      -- Check if user is Psychiatrist
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.role = 'PSIQUIATRA' OR profiles.clinical_role = 'PSIQUIATRA')
      )
      AND (visible_to_psychiatrist IS TRUE OR visible_to_psychiatrist IS NULL)
    )
  )
);
