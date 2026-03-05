-- Create storage bucket for rescue/marketing media (audio, images, videos, documents)
-- This bucket is used by marketing campaigns, rescue templates, and bulk dispatches
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('rescue-media', 'rescue-media', true, 52428800) -- 50MB limit for videos
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = NULL;

-- Remove any MIME type restriction to allow all file types
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'rescue-media';

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload rescue media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'rescue-media');

-- Allow public read access (needed for WhatsApp API to fetch media)
CREATE POLICY "Public read access for rescue media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'rescue-media');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update rescue media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'rescue-media');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete rescue media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'rescue-media');
