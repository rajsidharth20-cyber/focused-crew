DROP POLICY IF EXISTS "See own invites" ON public.group_invites;
CREATE POLICY "See own invites"
ON public.group_invites
FOR SELECT
TO authenticated
USING (
  invitee_id = auth.uid()
  OR inviter_id = auth.uid()
  OR private.is_group_admin(group_id, auth.uid())
);

DROP POLICY IF EXISTS "Invitee responds" ON public.group_invites;
CREATE POLICY "Invitee responds"
ON public.group_invites
FOR UPDATE
TO authenticated
USING (invitee_id = auth.uid() AND status = 'pending')
WITH CHECK (
  invitee_id = auth.uid()
  AND status IN ('accepted', 'declined')
);

CREATE OR REPLACE FUNCTION private.validate_group_invite_response()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.group_id IS DISTINCT FROM OLD.group_id
     OR NEW.inviter_id IS DISTINCT FROM OLD.inviter_id
     OR NEW.invitee_id IS DISTINCT FROM OLD.invitee_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Invite identity fields cannot be changed';
  END IF;

  IF OLD.status <> 'pending' OR NEW.status NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Invalid invite status transition';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_group_invite_response ON public.group_invites;
CREATE TRIGGER validate_group_invite_response
BEFORE UPDATE ON public.group_invites
FOR EACH ROW
EXECUTE FUNCTION private.validate_group_invite_response();

DROP POLICY IF EXISTS "Upload own social media" ON storage.objects;
CREATE POLICY "Upload own social media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'social'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND lower(COALESCE(metadata->>'mimetype', '')) IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'
  )
  AND COALESCE((metadata->>'size')::bigint, 0) BETWEEN 1 AND 8388608
);

CREATE POLICY "Update own social media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'social'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'social'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND owner = auth.uid()
  AND lower(COALESCE(metadata->>'mimetype', '')) IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'
  )
  AND COALESCE((metadata->>'size')::bigint, 0) BETWEEN 1 AND 8388608
);

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND owner = auth.uid()
  AND lower(COALESCE(metadata->>'mimetype', '')) IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'
  )
  AND COALESCE((metadata->>'size')::bigint, 0) BETWEEN 1 AND 2097152
);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND owner = auth.uid()
  AND lower(COALESCE(metadata->>'mimetype', '')) IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'
  )
  AND COALESCE((metadata->>'size')::bigint, 0) BETWEEN 1 AND 2097152
);

DROP POLICY IF EXISTS "Group members upload group images" ON storage.objects;
CREATE POLICY "Group members upload group images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'group-images'
  AND private.is_group_member(((storage.foldername(name))[1])::uuid, auth.uid())
  AND owner = auth.uid()
  AND lower(COALESCE(metadata->>'mimetype', '')) IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'
  )
  AND COALESCE((metadata->>'size')::bigint, 0) BETWEEN 1 AND 8388608
);

DROP POLICY IF EXISTS "Uploader updates group images" ON storage.objects;
CREATE POLICY "Uploader updates group images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'group-images' AND owner = auth.uid())
WITH CHECK (
  bucket_id = 'group-images'
  AND owner = auth.uid()
  AND private.is_group_member(((storage.foldername(name))[1])::uuid, auth.uid())
  AND lower(COALESCE(metadata->>'mimetype', '')) IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'
  )
  AND COALESCE((metadata->>'size')::bigint, 0) BETWEEN 1 AND 8388608
);