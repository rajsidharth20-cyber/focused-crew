import { useEffect, useState } from 'react';
import { Check, Loader2, Shuffle, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Skip availability checks (guest mode stores locally). */
  local?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

/** Username input with live availability check and unique-username generator. */
export function UsernameField({ value, onChange, local, placeholder, autoFocus }: Props) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (local) return;
    const v = value.trim();
    if (v.length < 3) {
      setStatus('idle');
      return;
    }
    setStatus('checking');
    const id = setTimeout(async () => {
      const { data } = await supabase.rpc('username_available', { _username: v });
      setStatus(data ? 'free' : 'taken');
    }, 400);
    return () => clearTimeout(id);
  }, [value, local]);

  const generate = async () => {
    setGenerating(true);
    const { data } = await supabase.rpc('suggest_usernames', { _base: value.trim() || null });
    const list = (data as { username: string }[] | null) ?? [];
    if (list.length > 0) onChange(list[Math.floor(Math.random() * Math.min(list.length, 5))].username);
    setGenerating(false);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={value}
            autoFocus={autoFocus}
            onChange={e => onChange(e.target.value.replace(/\s/g, ''))}
            placeholder={placeholder ?? 'Pick a username'}
            aria-label="Username"
            className="pr-8"
          />
          {!local && status !== 'idle' && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {status === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              {status === 'free' && <Check className="w-4 h-4 text-emerald-500" />}
              {status === 'taken' && <X className="w-4 h-4 text-destructive" />}
            </span>
          )}
        </div>
        {!local && (
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 rounded-md border border-border text-xs font-medium hover:bg-secondary transition disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shuffle className="w-3.5 h-3.5" />}
            Generate
          </button>
        )}
      </div>
      {!local && status === 'taken' && (
        <p className="text-[11px] text-destructive">That username is already taken.</p>
      )}
      {!local && status === 'free' && (
        <p className="text-[11px] text-emerald-600">Available — others can find you with this.</p>
      )}
    </div>
  );
}
