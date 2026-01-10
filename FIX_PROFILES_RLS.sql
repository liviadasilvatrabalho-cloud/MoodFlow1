-- Allow ADMIN_CLINICA to view all profiles
-- This fixes the issue where admins see "empty" or missing professionals in the clinic list
-- because they are not allowed to select from the 'profiles' table by default RLS.

-- 1. Create a helper function to check if user is admin (security definer to bypass RLS)
create or replace function public.is_admin()
returns boolean as $$
begin
  return (select role from profiles where id = auth.uid()) = 'ADMIN_CLINICA';
end;
$$ language plpgsql security definer;

-- 2. Create the policy for profiles
drop policy if exists "Admins can view all profiles" on profiles;

create policy "Admins can view all profiles"
on profiles for select
to authenticated
using (
  is_admin()
);

-- 3. Also ensure they can view clinic members (just in case)
drop policy if exists "Admins can view clinic members" on clinic_members;

create policy "Admins can view clinic members"
on clinic_members for select
to authenticated
using (
  exists (
    select 1 from clinics
    where clinics.id = clinic_members.clinic_id
    and clinics.admin_id = auth.uid()
  )
);
