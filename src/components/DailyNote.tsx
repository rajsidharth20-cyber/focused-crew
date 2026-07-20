import { useEffect, useMemo, useState } from 'react';
import { NotebookPen, Save, Check, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getEffectiveToday } from '@/lib/day-boundary';
import { toast } from 'sonner';

const GUEST_KEY = 'taskpilot_daily_notes';

type Notes = Record<string, string>;

function loadGuest(): Notes {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) || '{}'); } catch { return {}; }
}
function saveGuest(n: Notes) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(n));
}

export function DailyNote() {
  const { user, isGuest } = useAuth();
  const [date, setDate] = useState<string>(() => getEffectiveToday());
  const [content, setContent] = useState('');
  const [initial, setInitial] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = content !== initial;
  const isToday = useMemo(() => date === getEffectiveToday(), [date]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      if (isGuest || !user) {
        const all = loadGuest();
        const v = all[date] || '';
        if (!cancelled) { setContent(v); setInitial(v); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from('daily_notes')
        .select('content')
        .eq('user_id', user.id)
        .eq('date', date)
        .maybeSingle();
      if (!cancelled) {
        const v = data?.content || '';
        setContent(v); setInitial(v); setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [date, user, isGuest]);

  const save = async () => {
    setSaving(true);
    try {
      if (isGuest || !user) {
        const all = loadGuest();
        if (content.trim()) all[date] = content;
        else delete all[date];
        saveGuest(all);
      } else {
        const { error } = await supabase
          .from('daily_notes')
          .upsert({ user_id: user.id, date, content }, { onConflict: 'user_id,date' });
        if (error) throw error;
      }
      setInitial(content);
      toast.success('Note saved');
    } catch (e) {
      console.error(e);
      toast.error('Could not save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <NotebookPen className="w-4 h-4 text-primary shrink-0" />
          <h3 className="font-display text-sm font-semibold tracking-wide uppercase text-gradient truncate">
            Daily Note
          </h3>
          {dirty && <span className="text-[10px] uppercase tracking-widest text-accent">Unsaved</span>}
          {!dirty && !loading && initial && (
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-background border border-border/60 rounded-md pl-7 pr-2 py-1.5 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          {!isToday && (
            <button
              onClick={() => setDate(getEffectiveToday())}
              className="text-[11px] px-2 py-1.5 rounded-md border border-border/60 hover:bg-secondary transition"
            >
              Today
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-2">
        A free-form journal for the day — what went well, what to improve, reflections. The AI Control Tower can read today's note.
      </p>

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="How did the day go? What can you improve tomorrow?"
        rows={7}
        disabled={loading}
        className="w-full bg-background border border-border/60 rounded-lg px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/50 resize-y min-h-[140px] disabled:opacity-60"
      />

      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {content.length} chars
        </span>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-gradient-primary text-primary-foreground font-semibold shadow-md hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save note
        </button>
      </div>
    </div>
  );
}
