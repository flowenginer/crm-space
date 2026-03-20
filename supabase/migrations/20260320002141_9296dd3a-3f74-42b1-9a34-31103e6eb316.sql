-- Add header_media_url column to store permanent Storage URL
ALTER TABLE public.meta_message_templates 
ADD COLUMN IF NOT EXISTS header_media_url TEXT;

-- Create public storage bucket for template media
INSERT INTO storage.buckets (id, name, public)
VALUES ('template-media', 'template-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read from the bucket (public)
CREATE POLICY "Public read access for template-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'template-media');

-- Allow authenticated users to upload to the bucket
CREATE POLICY "Authenticated users can upload template-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'template-media');

-- Allow service role to manage (for edge functions)
CREATE POLICY "Service role can manage template-media"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'template-media');