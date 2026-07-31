
CREATE POLICY "Group members read group images" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'group-images'
    AND public.is_group_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "Group members upload group images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'group-images'
    AND public.is_group_member(((storage.foldername(name))[1])::uuid, auth.uid())
    AND owner = auth.uid()
  );

CREATE POLICY "Uploader deletes group images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'group-images' AND owner = auth.uid());
