import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { assertImageFile } from '@/lib/upload-guard';

const cache = new Map<string, string>();

/** Uploads an image into the private `social` bucket under the user's own folder. */
export async function uploadSocialImage(userId: string, file: File, folder: 'posts' | 'stories') {
  assertImageFile(file);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('social').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

/** Turns a storage path (or plain URL) into something an <img> can render. */
export function useSocialImage(pathOrUrl?: string | null) {
  const [url, setUrl] = useState<string>(() => (pathOrUrl ? cache.get(pathOrUrl) ?? '' : ''));

  useEffect(() => {
    let cancelled = false;
    if (!pathOrUrl) {
      setUrl('');
      return;
    }
    if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('http')) {
      setUrl(pathOrUrl);
      return;
    }
    const cached = cache.get(pathOrUrl);
    if (cached) {
      setUrl(cached);
      return;
    }
    supabase.storage
      .from('social')
      .createSignedUrl(pathOrUrl, 60 * 60)
      .then(({ data }) => {
        if (cancelled) return;
        const signed = data?.signedUrl ?? '';
        if (signed) cache.set(pathOrUrl, signed);
        setUrl(signed);
      });
    return () => {
      cancelled = true;
    };
  }, [pathOrUrl]);

  return url;
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}
