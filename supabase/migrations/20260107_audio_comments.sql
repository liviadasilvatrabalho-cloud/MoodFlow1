-- Add audio support to doctor_notes
ALTER TABLE doctor_notes ADD COLUMN IF NOT EXISTS type text DEFAULT 'text' CHECK (type IN ('text', 'audio'));
ALTER TABLE doctor_notes ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE doctor_notes ADD COLUMN IF NOT EXISTS duration integer; -- Duration in seconds

-- Create bucket for audio comments if it doesn't exist (this is usually done via dashboard, but good to document)
-- insert into storage.buckets (id, name, public) values ('audio-comments', 'audio-comments', false);

-- Policy to allow authenticated users to upload audio (simplified, ideally strictly scoped)
-- create policy "Allow authenticated uploads" on storage.objects for insert to authenticated with check (bucket_id = 'audio-comments');
