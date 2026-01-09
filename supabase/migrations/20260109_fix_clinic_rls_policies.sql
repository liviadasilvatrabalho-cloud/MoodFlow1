-- Migration: Fix Clinic RLS Policies
-- Date: 2026-01-09
-- Description: Adds RLS policies for clinics and clinic_members tables to allow proper admin access

-- Enable RLS on clinics table
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- Enable RLS on clinic_members table
ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CLINICS TABLE POLICIES
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins veem suas próprias clínicas" ON public.clinics;
DROP POLICY IF EXISTS "Admins can insert clinics" ON public.clinics;
DROP POLICY IF EXISTS "Admins can update their clinics" ON public.clinics;
DROP POLICY IF EXISTS "Members can view their clinic" ON public.clinics;

-- Policy: Admins can view their own clinics
CREATE POLICY "Admins veem suas próprias clínicas"
ON public.clinics
FOR SELECT
TO authenticated
USING (admin_id = auth.uid());

-- Policy: Admins can insert new clinics
CREATE POLICY "Admins can insert clinics"
ON public.clinics
FOR INSERT
TO authenticated
WITH CHECK (admin_id = auth.uid());

-- Policy: Admins can update their own clinics
CREATE POLICY "Admins can update their clinics"
ON public.clinics
FOR UPDATE
TO authenticated
USING (admin_id = auth.uid())
WITH CHECK (admin_id = auth.uid());

-- Policy: Members can view clinics they belong to
CREATE POLICY "Members can view their clinic"
ON public.clinics
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT clinic_id 
    FROM public.clinic_members 
    WHERE doctor_id = auth.uid() OR patient_id = auth.uid()
  )
);

-- ============================================
-- CLINIC_MEMBERS TABLE POLICIES
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Membros veem seus próprios vínculos" ON public.clinic_members;
DROP POLICY IF EXISTS "Admins can manage clinic members" ON public.clinic_members;
DROP POLICY IF EXISTS "Admins can insert clinic members" ON public.clinic_members;
DROP POLICY IF EXISTS "Admins can update clinic members" ON public.clinic_members;
DROP POLICY IF EXISTS "Admins can delete clinic members" ON public.clinic_members;

-- Policy: Members can view their own links
CREATE POLICY "Membros veem seus próprios vínculos"
ON public.clinic_members
FOR SELECT
TO authenticated
USING (
  doctor_id = auth.uid() 
  OR patient_id = auth.uid() 
  OR clinic_id IN (SELECT id FROM public.clinics WHERE admin_id = auth.uid())
);

-- Policy: Admins can insert members to their clinics
CREATE POLICY "Admins can insert clinic members"
ON public.clinic_members
FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id IN (SELECT id FROM public.clinics WHERE admin_id = auth.uid())
);

-- Policy: Admins can update members in their clinics
CREATE POLICY "Admins can update clinic members"
ON public.clinic_members
FOR UPDATE
TO authenticated
USING (
  clinic_id IN (SELECT id FROM public.clinics WHERE admin_id = auth.uid())
)
WITH CHECK (
  clinic_id IN (SELECT id FROM public.clinics WHERE admin_id = auth.uid())
);

-- Policy: Admins can delete members from their clinics
CREATE POLICY "Admins can delete clinic members"
ON public.clinic_members
FOR DELETE
TO authenticated
USING (
  clinic_id IN (SELECT id FROM public.clinics WHERE admin_id = auth.uid())
);
