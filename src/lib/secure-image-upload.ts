import { supabase } from '@/integrations/supabase/client';

type ImageBucket = 'avatars' | 'social' | 'group-images';

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function secureImageUpload(options: {
  bucket: ImageBucket;
  file: File;
  folder?: 'posts' | 'stories';
  groupId?: string;
}) {
  const { data, error } = await supabase.functions.invoke('upload-image', {
    body: {
      bucket: options.bucket,
      bytes: toBase64(new Uint8Array(await options.file.arrayBuffer())),
      folder: options.folder,
      groupId: options.groupId,
    },
  });

  if (error) throw error;
  if (!data?.path) throw new Error('Image upload failed.');
  return data.path as string;
}