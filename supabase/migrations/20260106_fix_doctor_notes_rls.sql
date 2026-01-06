-- Migration: Fix Doctor Notes RLS
-- Date: 2026-01-06
-- Description: Consolidates redundant RLS policies on doctor_notes into clear, non-overlapping rules.

-- 1. Enable RLS (ensure it is on)
ALTER TABLE doctor_notes ENABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Doctors manage own notes" ON doctor_notes;
DROP POLICY IF EXISTS "Doutores gerenciam suas notas" ON doctor_notes;
DROP POLICY IF EXISTS "Medicos veem seus comentarios" ON doctor_notes;
DROP POLICY IF EXISTS "Pacientes veem notas autorizadas" ON doctor_notes;
DROP POLICY IF EXISTS "Patients can reply" ON doctor_notes;
DROP POLICY IF EXISTS "Users can insert their own notes" ON doctor_notes;
DROP POLICY IF EXISTS "Users can view relevant notes" ON doctor_notes;

-- 3. Create Consolidated Policies

-- Policy: Doctors have FULL access to notes where they are the doctor
CREATE POLICY "Doctors full access" ON doctor_notes
FOR ALL
USING (auth.uid() = doctor_id)
WITH CHECK (auth.uid() = doctor_id);

-- Policy: Patients can VIEW notes that are explicitly shared OR authored by them
CREATE POLICY "Patients view shared or own" ON doctor_notes
FOR SELECT
USING (
  (auth.uid() = patient_id) 
  AND 
  (
    is_shared = true 
    OR author_role IN ('PACIENTE', 'PATIENT')
  )
);

-- Policy: Patients can INSERT notes (replies) if they are the patient and author
CREATE POLICY "Patients insert replies" ON doctor_notes
FOR INSERT
WITH CHECK (
  auth.uid() = patient_id 
  AND author_role IN ('PACIENTE', 'PATIENT')
);

-- Policy: Patients can UPDATE notes they authored (e.g. editing a reply)
CREATE POLICY "Patients edit own notes" ON doctor_notes
FOR UPDATE
USING (
  auth.uid() = patient_id 
  AND author_role IN ('PACIENTE', 'PATIENT')
)
WITH CHECK (
  auth.uid() = patient_id 
  AND author_role IN ('PACIENTE', 'PATIENT')
);
