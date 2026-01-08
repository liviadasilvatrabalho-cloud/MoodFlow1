-- Migration: Add status column to message_threads
-- Date: 2026-01-08
-- Description: Adds the missing 'status' column required by the application code.

ALTER TABLE "public"."message_threads" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active';

NOTIFY pgrst, 'reload config';
