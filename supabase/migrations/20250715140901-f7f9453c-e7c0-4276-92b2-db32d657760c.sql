
-- Fix storage policies for submissions bucket to allow proper file uploads
-- First, drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all submission files" ON storage.objects;

-- Create updated storage policies that properly handle file uploads
CREATE POLICY "Users can upload their own files" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'submissions' AND 
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own files" 
  ON storage.objects FOR SELECT 
  USING (
    bucket_id = 'submissions' AND 
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own files" 
  ON storage.objects FOR UPDATE 
  USING (
    bucket_id = 'submissions' AND 
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own files" 
  ON storage.objects FOR DELETE 
  USING (
    bucket_id = 'submissions' AND 
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can view all submission files" 
  ON storage.objects FOR SELECT 
  USING (
    bucket_id = 'submissions' AND 
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Also make sure the bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public) 
VALUES ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;
