-- Migration: Patients Delete Own Notes
-- Date: 2026-01-07
-- Description: Adds a DELETE policy to allow patients to delete their own notes.

CREATE POLICY "Patients delete own notes" ON doctor_notes
FOR DELETE
USING (
  auth.uid() = patient_id 
  AND author_role IN ('PACIENTE', 'PATIENT')
);
