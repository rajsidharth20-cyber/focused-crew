import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const TTL_MS = 55 * 60 * 1000; // signed URLs live 1h — refresh slightly early
const cache = new Map<string, { url: string; expires: number }>();
const inFlight = new Map<string, Promise<string>>();

function cachedUrl(path: string): string {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  if (hit) cache.delete(path);
  return '';
}

function signAvatar(path: string): Promise<string> {
  const pending = inFlight.get(path);
  if (pending) return pending;
  const p = supabase.storage
    .from('avatars')
    .createSignedUrl(path, 60 * 60)
    .then(({ data }) => {
      const signed = data?.signedUrl ?? '';
      if (signed) cache.set(path, { url: signed, expires: Date.now() + TTL_MS });
      return signed;
    })
    .catch(() => '')
    .finally(() => { inFlight.delete(path); });
  inFlight.set(path, p);
  return p;
}

/** Resolves an avatar value (storage path, data URL or absolute URL) to a displayable URL. */
export function useSignedAvatar(pathOrUrl?: string | null) {
  const [url, setUrl] = useState<string>(() => {
    if (!pathOrUrl) return '';
    if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('http')) return pathOrUrl;
    return cachedUrl(pathOrUrl);
  });

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
    const cached = cachedUrl(pathOrUrl);
    if (cached) {
      setUrl(cached);
      return;
    }
    signAvatar(pathOrUrl).then(signed => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [pathOrUrl]);

  return url;
}

interface Props {
  src?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
  /** Shows a green ring + dot when the person is studying right now. */
  live?: boolean;
}

export function UserAvatar({ src, name, className, fallbackClassName, live }: Props) {
  const url = useSignedAvatar(src);
  const label = name || 'Pilot';
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar className={cn('w-9 h-9', live && 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-background', className)}>
        {url && <AvatarImage src={url} alt={label} />}
        <AvatarFallback className={fallbackClassName}>
          {label.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {live && (
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
      )}
    </span>
  );
}
