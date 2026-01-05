-- Migration: Fix RLS Policy for message_threads
-- Date: 2026-01-05
-- Description: Drop existing restrictive policy and recreate to explicitly allow participants to insert threads.

drop policy if exists "Usuários podem criar threads" on "public"."message_threads";

create policy "Enable insert for participants"
on "public"."message_threads"
as permissive
for insert
to authenticated
with check (
  (auth.uid() = patient_id) OR (auth.uid() = professional_id)
);
