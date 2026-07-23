
-- Restrict avatar SELECT to owner folder
DROP POLICY IF EXISTS "Avatar images are viewable by everyone" ON storage.objects;
CREATE POLICY "Users can view their own avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- Revoke EXECUTE on SECURITY DEFINER trigger functions from public roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
