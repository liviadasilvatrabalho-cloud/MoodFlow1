-- Create the storage bucket for audio comments
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audio-comments', 
  'audio-comments', 
  false, 
  10485760, -- 10MB limit
  ARRAY['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4']
)
on conflict (id) do nothing;

-- Enable RLS on storage.objects if not already enabled (usually is)
alter table storage.objects enable row level security;

-- Policy: Allow authenticated users to upload audio files
create policy "Authenticated users can upload audio notes"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'audio-comments' );

-- Policy: Allow authenticated users to view/download audio files
-- (Required for createSignedUrl to work for the user themselves, and for others if RLS applied)
create policy "Authenticated users can read audio notes"
on storage.objects for select
to authenticated
using ( bucket_id = 'audio-comments' );

-- Policy: Allow users to delete their own audio files (optional, good for cleanup)
create policy "Users can delete their own audio notes"
on storage.objects for delete
to authenticated
using ( bucket_id = 'audio-comments' AND owner = auth.uid() );
