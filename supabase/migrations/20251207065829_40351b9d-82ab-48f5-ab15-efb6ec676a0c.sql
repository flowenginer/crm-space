-- Create storage bucket for template attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('template-attachments', 'template-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload template attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'template-attachments');

-- Allow authenticated users to update their own uploads
CREATE POLICY "Authenticated users can update template attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'template-attachments');

-- Allow authenticated users to delete template attachments
CREATE POLICY "Authenticated users can delete template attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'template-attachments');

-- Allow public read access
CREATE POLICY "Public can read template attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'template-attachments');