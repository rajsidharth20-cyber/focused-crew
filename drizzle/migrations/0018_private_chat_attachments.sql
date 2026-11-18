ALTER TABLE public.messages ADD COLUMN attachment_path text, ADD COLUMN attachment_name text, ADD COLUMN attachment_type text, ADD COLUMN attachment_size integer;
ALTER TABLE public.messages ADD CONSTRAINT message_attachment_complete CHECK ((attachment_path IS NULL AND attachment_name IS NULL AND attachment_type IS NULL AND attachment_size IS NULL) OR (attachment_path IS NOT NULL AND attachment_name IS NOT NULL AND length(attachment_name) BETWEEN 1 AND 255 AND attachment_type IS NOT NULL AND attachment_size BETWEEN 1 AND 20971520));
CREATE OR REPLACE FUNCTION public.validate_dm_attachment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,storage AS $$
BEGIN
 IF NEW.attachment_path IS NOT NULL THEN
  IF NEW.bot_type IS NOT NULL OR split_part(NEW.attachment_path,'/',1) <> NEW.sender_id::text OR split_part(NEW.attachment_path,'/',2) <> NEW.receiver_id::text OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='chat-attachments' AND o.name=NEW.attachment_path AND (o.metadata->>'size')::bigint=NEW.attachment_size) THEN RAISE EXCEPTION 'Invalid private chat attachment'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_dm_attachment BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.validate_dm_attachment();
CREATE POLICY "Upload private chat attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='chat-attachments' AND (storage.foldername(name))[1]=auth.uid()::text AND private.dm_allowed(auth.uid(),((storage.foldername(name))[2])::uuid) AND NOT private.is_restricted(auth.uid()) AND (metadata->>'size')::bigint BETWEEN 1 AND 20971520);
CREATE POLICY "Read private chat attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='chat-attachments' AND ((storage.foldername(name))[1]=auth.uid()::text OR EXISTS(SELECT 1 FROM public.messages m WHERE m.attachment_path=name AND m.receiver_id=auth.uid())));
CREATE POLICY "Remove own private chat attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='chat-attachments' AND (storage.foldername(name))[1]=auth.uid()::text);