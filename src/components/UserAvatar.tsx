import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// Signed links live 7 days; we refresh a day early. Cached on-device so repeat
// visits show photos instantly without a signing round-trip.
const SIGN_SECONDS = 7 * 24 * 60 * 60;
const TTL_MS = 6 * 24 * 60 * 60 * 1000;
const LS_KEY = 'fc_avatar_urls_v1';

type Entry = { url: string; expires: number };
const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<string>>();

(() => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const now = Date.now();
    for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, Entry>)) {
      if (v && v.expires > now) cache.set(k, v);
    }
  } catch { /* ignore */ }
})();

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const obj: Record<string, Entry> = {};
      cache.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem(LS_KEY, JSON.stringify(obj));
    } catch { /* ignore */ }
  }, 300);
}

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
    .createSignedUrl(path, SIGN_SECONDS)
    .then(({ data }) => {
      const signed = data?.signedUrl ?? '';
      if (signed) {
        cache.set(path, { url: signed, expires: Date.now() + TTL_MS });
        persist();
      }
      return signed;
    })
    .catch(() => '')
    .finally(() => { inFlight.delete(path); });
  inFlight.set(path, p);
  return p;
}

/** Pre-signs a batch of avatar paths in one request (e.g. for chat/member lists). */
export async function prefetchAvatars(paths: Array<string | null | undefined>) {
  const need = Array.from(new Set(
    paths.filter((p): p is string => !!p && !p.startsWith('data:') && !p.startsWith('http') && !cachedUrl(p) && !inFlight.has(p)),
  ));
  if (need.length === 0) return;
  try {
    const { data } = await supabase.storage.from('avatars').createSignedUrls(need, SIGN_SECONDS);
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) cache.set(row.path, { url: row.signedUrl, expires: Date.now() + TTL_MS });
    }
    persist();
  } catch { /* ignore */ }
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
        {url && <AvatarImage src={url} alt={label} loading="lazy" decoding="async" />}
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
