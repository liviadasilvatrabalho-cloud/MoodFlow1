-- =================================================================
-- SOLUÇÃO FINAL: LIMPEZA TOTAL E CORREÇÃO
-- =================================================================
-- Este script usa um bloco de código para remover TODAS as políticas,
-- independentemente do nome, e depois cria as corretas.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Remover TODAS as políticas da tabela CLINICS
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'clinics' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.clinics';
        RAISE NOTICE 'Dropped policy: % on clinics', r.policyname;
    END LOOP;

    -- 2. Remover TODAS as políticas da tabela CLINIC_MEMBERS
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'clinic_members' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.clinic_members';
        RAISE NOTICE 'Dropped policy: % on clinic_members', r.policyname;
    END LOOP;
END $$;

-- 3. Garantir que RLS está habilitado
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- CRIAÇÃO DAS POLÍTICAS CORRETAS (SEM RECURSÃO)
-- =================================================================

-- --- CLINICS ---

-- Admins podem ver suas próprias clínicas
CREATE POLICY "Admins_Select_Own"
ON public.clinics FOR SELECT TO authenticated
USING (admin_id = auth.uid());

-- Admins podem criar clínicas
CREATE POLICY "Admins_Insert"
ON public.clinics FOR INSERT TO authenticated
WITH CHECK (admin_id = auth.uid());

-- Admins podem atualizar suas clínicas
CREATE POLICY "Admins_Update_Own"
ON public.clinics FOR UPDATE TO authenticated
USING (admin_id = auth.uid())
WITH CHECK (admin_id = auth.uid());

-- Admins podem deletar suas clínicas
CREATE POLICY "Admins_Delete_Own"
ON public.clinics FOR DELETE TO authenticated
USING (admin_id = auth.uid());

-- --- CLINIC_MEMBERS ---

-- Membros (médicos/pacientes) podem ver seus próprios vínculos
CREATE POLICY "Members_Select_Own"
ON public.clinic_members FOR SELECT TO authenticated
USING (doctor_id = auth.uid() OR patient_id = auth.uid());

-- Admins podem ver todos os membros de suas clínicas
CREATE POLICY "Admins_Select_Clinic_Members"
ON public.clinic_members FOR SELECT TO authenticated
USING (clinic_id IN (SELECT id FROM public.clinics WHERE admin_id = auth.uid()));

-- Admins podem adicionar membros
CREATE POLICY "Admins_Insert_Members"
ON public.clinic_members FOR INSERT TO authenticated
WITH CHECK (clinic_id IN (SELECT id FROM public.clinics WHERE admin_id = auth.uid()));

-- Admins podem atualizar membros
CREATE POLICY "Admins_Update_Members"
ON public.clinic_members FOR UPDATE TO authenticated
USING (clinic_id IN (SELECT id FROM public.clinics WHERE admin_id = auth.uid()))
WITH CHECK (clinic_id IN (SELECT id FROM public.clinics WHERE admin_id = auth.uid()));

-- Admins podem remover membros
CREATE POLICY "Admins_Delete_Members"
ON public.clinic_members FOR DELETE TO authenticated
USING (clinic_id IN (SELECT id FROM public.clinics WHERE admin_id = auth.uid()));
