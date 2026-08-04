-- =============================================================
-- Create Supabase Storage bucket for video uploads
-- Run in Supabase SQL Editor
-- =============================================================

-- 1. Create the videos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow authenticated uploads
CREATE POLICY "Authenticated can upload videos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'videos');

-- 3. Allow public read access
CREATE POLICY "Public can read videos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'videos');

-- 4. Allow authenticated deletes
CREATE POLICY "Authenticated can delete videos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'videos');
