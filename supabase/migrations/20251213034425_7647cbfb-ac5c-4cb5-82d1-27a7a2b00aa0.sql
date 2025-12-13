-- Create documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload documents
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Create policy to allow anyone to view documents (public bucket)
CREATE POLICY "Anyone can view documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'documents');

-- Create policy to allow authenticated users to delete their own documents
CREATE POLICY "Authenticated users can delete documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documents');