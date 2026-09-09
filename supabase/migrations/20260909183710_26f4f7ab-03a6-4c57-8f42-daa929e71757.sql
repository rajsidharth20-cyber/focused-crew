CREATE POLICY "Uploader updates group images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'group-images' AND owner = auth.uid())
WITH CHECK (
  bucket_id = 'group-images'
  AND owner = auth.uid()
  AND private.is_group_member(((storage.foldername(name))[1])::uuid, auth.uid())
);