-- ============================================
-- SOLUÇÃO COMPLETA - COPIE E COLE TUDO
-- ============================================
-- Este script remove TODAS as políticas antigas e cria novas SEM recursão

-- PASSO 1: Remover TODAS as políticas antigas
DROP POLICY IF EXISTS "Admins veem suas próprias clínicas" ON public.clinics;
DROP POLICY IF EXISTS "Admins can insert clinics" ON public.clinics;
DROP POLICY IF EXISTS "Admins can update their clinics" ON public.clinics;
DROP POLICY IF EXISTS "Members can view their clinic" ON public.clinics;
DROP POLICY IF EXISTS "Admins can delete their clinics" ON public.clinics;

DROP POLICY IF EXISTS "Membros veem seus próprios vínculos" ON public.clinic_members;
DROP POLICY IF EXISTS "Admins can manage clinic members" ON public.clinic_members;
DROP POLICY IF EXISTS "Admins can insert clinic members" ON public.clinic_members;
DROP POLICY IF EXISTS "Admins can update clinic members" ON public.clinic_members;
DROP POLICY IF EXISTS "Admins can delete clinic members" ON public.clinic_members;
DROP POLICY IF EXISTS "Members can view their links" ON public.clinic_members;
DROP POLICY IF EXISTS "Admins can view clinic members" ON public.clinic_members;

-- PASSO 2: Habilitar RLS
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;

-- PASSO 3: Criar políticas para CLINICS (SEM recursão)
CREATE POLICY "Admins veem suas próprias clínicas"
ON public.clinics FOR SELECT TO authenticated
USING (admin_id = auth.uid());

CREATE POLICY "Admins can insert clinics"
ON public.clinics FOR INSERT TO authenticated
WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Admins can update their clinics"
ON public.clinics FOR UPDATE TO authenticated
USING (admin_id = auth.uid())
WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Admins can delete their clinics"
ON public.clinics FOR DELETE TO authenticated
USING (admin_id = auth.uid());

-- PASSO 4: Criar políticas para CLINIC_MEMBERS (SEM recursão)
CREATE POLICY "Members can view their links"
ON public.clinic_members FOR SELECT TO authenticated
USING (doctor_id = auth.uid() OR patient_id = auth.uid());

CREATE POLICY "Admins can view clinic members"
ON public.clinic_members FOR SELECT TO authenticated
USING (clinic_id IN (SELECT id FROM public.clinics WHERE admin_id = auth.uid()));

CREATE POLICY "Admins can insert clinic members"
ON public.clinic_members FOR INSERT TO authenticated
WITH CHECK (clinic_id IN (SELECT id FROM public.clinics WHERE admin_id = auth.uid()));

CREATE POLICY "Admins can update clinic members"
ON public.clinic_members FOR UPDATE TO authenticated
USING (clinic_id IN (SELECT id FROM public.clinics WHERE admin_id = auth.uid()))
WITH CHECK (clinic_id IN (SELECT id FROM public.clinics WHERE admin_id = auth.uid()));

CREATE POLICY "Admins can delete clinic members"
ON public.clinic_members FOR DELETE TO authenticated
USING (clinic_id IN (SELECT id FROM public.clinics WHERE admin_id = auth.uid()));

-- CONCLUÍDO! Agora teste criar uma clínica.
