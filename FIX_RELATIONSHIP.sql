-- FIX: Establish Foreign Key Relationship between clinic_members and profiles
-- This is necessary for the API to fetch doctor details (name, email) when querying clinic members.

-- 1. Try to drop the existing constraint if it exists (and might be pointing to auth.users or be broken)
-- We wrap in a block to avoid erroring if it doesn't exist with this specific name
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinic_members_doctor_id_fkey') THEN
        ALTER TABLE clinic_members DROP CONSTRAINT clinic_members_doctor_id_fkey;
    END IF;
END $$;

-- 2. Add the correct constraint pointing to public.profiles
ALTER TABLE clinic_members
ADD CONSTRAINT clinic_members_doctor_id_fkey
FOREIGN KEY (doctor_id) REFERENCES public.profiles(id);

-- 3. Grant permissions just in case (though RLS handles visibility)
GRANT REFERENCES ON public.profiles TO authenticated;
GRANT REFERENCES ON public.profiles TO service_role;
