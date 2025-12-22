-- Create storage bucket for tenant logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-logos', 'tenant-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view tenant logos (public bucket)
CREATE POLICY "Tenant logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-logos');

-- Policy: Only admins can upload their tenant's logo
CREATE POLICY "Admins can upload tenant logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-logos' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'supervisor')
    AND tenant_id::text = (storage.foldername(name))[1]
  )
);

-- Policy: Only admins can update their tenant's logo
CREATE POLICY "Admins can update tenant logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tenant-logos' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'supervisor')
    AND tenant_id::text = (storage.foldername(name))[1]
  )
);

-- Policy: Only admins can delete their tenant's logo
CREATE POLICY "Admins can delete tenant logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tenant-logos' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'supervisor')
    AND tenant_id::text = (storage.foldername(name))[1]
  )
);