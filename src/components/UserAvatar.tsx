import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const cache = new Map<string, string>();

/** Resolves an avatar value (storage path, data URL or absolute URL) to a displayable URL. */
export function useSignedAvatar(pathOrUrl?: string | null) {
  const [url, setUrl] = useState<string>(() =>
    pathOrUrl ? cache.get(pathOrUrl) ?? '' : ''
  );

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
      .from('avatars')
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
