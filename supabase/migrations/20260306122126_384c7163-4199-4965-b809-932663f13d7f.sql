
-- Add photo_url column to debts
ALTER TABLE public.debts ADD COLUMN photo_url text NULL;

-- Create storage bucket for debt photos
INSERT INTO storage.buckets (id, name, public) VALUES ('debt-photos', 'debt-photos', true);

-- Allow authenticated users to upload to their household's folder
CREATE POLICY "Users can upload debt photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'debt-photos');

CREATE POLICY "Users can view debt photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'debt-photos');

CREATE POLICY "Users can delete debt photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'debt-photos');

CREATE POLICY "Public can view debt photos" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'debt-photos');
