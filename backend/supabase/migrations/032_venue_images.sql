-- Add image_url to venues
ALTER TABLE venues ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- Create storage bucket for venue images
INSERT INTO storage.buckets (id, name, public)
VALUES ('venue-images', 'venue-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies

-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'venue-images' );

-- Allow court admins to upload (insert)
CREATE POLICY "Venue Owner Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'venue-images' AND
  auth.role() = 'authenticated'
);

-- Allow court admins to update
CREATE POLICY "Venue Owner Update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'venue-images' AND
  auth.role() = 'authenticated'
);

-- Allow court admins to delete
CREATE POLICY "Venue Owner Delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'venue-images' AND
  auth.role() = 'authenticated'
);
