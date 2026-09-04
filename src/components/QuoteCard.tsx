import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, RefreshCw, Sparkles, Plus, Trash2, User, Bookmark, BookmarkCheck, Clock } from 'lucide-react';
import { supabase as _supabase } from '@/integrations/supabase/client';
const supabase = _supabase as any;
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface UserQuote { id: string; text: string; author: string | null; }
interface DisplayQuote { text: string; author: string; source: 'user' | 'ai'; }

const GUEST_KEY = 'taskpilot_user_quotes';
const ROTATION_KEY = 'focusedcrew_quote_rotation_v1';
const FALLBACK: DisplayQuote = { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn', source: 'ai' };

/** How long a quote stays on screen before the next one appears. */
const ROTATION_OPTIONS: { label: string; ms: number }[] = [
  { label: 'Manual', ms: 0 },
  { label: '30s', ms: 30_000 },
  { label: '1 min', ms: 60_000 },
  { label: '5 min', ms: 5 * 60_000 },
  { label: '15 min', ms: 15 * 60_000 },
  { label: '1 hour', ms: 60 * 60_000 },
  { label: 'Daily', ms: 24 * 60 * 60_000 },
];

const loadRotation = () => {
  try {
    const raw = localStorage.getItem(ROTATION_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch { return 0; }
};

export function QuoteCard() {
  const { user, isGuest } = useAuth();
  const { theme } = useTheme();
  const [quote, setQuote] = useState<DisplayQuote>(FALLBACK);
  const [loading, setLoading] = useState(false);
  const [userQuotes, setUserQuotes] = useState<UserQuote[]>([]);
  const [open, setOpen] = useState(false);
  const [newText, setNewText] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [rotationMs, setRotationMs] = useState<number>(() => loadRotation());

  const loadUserQuotes = useCallback(async () => {
    if (isGuest || !user) {
      try {
        const raw = localStorage.getItem(GUEST_KEY);
        const list = raw ? JSON.parse(raw) : [];
        setUserQuotes(list);
        return list as UserQuote[];
      } catch { setUserQuotes([]); return []; }
    }
    const { data } = await supabase.from('user_quotes').select('*').order('created_at', { ascending: false });
    const list = (data ?? []) as UserQuote[];
    setUserQuotes(list);
    return list;
  }, [user, isGuest]);

  const fetchAIQuote = useCallback(async (): Promise<DisplayQuote> => {
    // AI quotes need a signed-in account; guests keep the built-in quote.
    if (isGuest || !user) return FALLBACK;
    const { data, error } = await supabase.functions.invoke('daily-quote', { body: { theme } });
    if (error || !data?.text) throw error ?? new Error('No quote');
    return { text: data.text, author: data.author || 'Unknown', source: 'ai' };
  }, [theme, isGuest, user]);

  const refresh = useCallback(async (list?: UserQuote[], silent = false) => {
    setLoading(true);
    try {
      const pool = list ?? userQuotes;
      if (pool.length > 0) {
        // Saved quotes take priority - pick random, avoid repeating current if possible
        const filtered = pool.length > 1 ? pool.filter(q => q.text !== quote.text) : pool;
        const pick = filtered[Math.floor(Math.random() * filtered.length)];
        setQuote({ text: pick.text, author: pick.author || 'You', source: 'user' });
      } else {
        const q = await fetchAIQuote();
        setQuote(q);
      }
    } catch (e) {
      console.error(e);
      if (!silent) toast.error('Could not fetch a new quote');
    } finally {
      setLoading(false);
    }
  }, [userQuotes, quote.text, fetchAIQuote]);

  // Initial load
  useEffect(() => {
    (async () => {
      const list = await loadUserQuotes();
      await refresh(list);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isGuest]);

  // Auto-rotate on the chosen cadence.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!rotationMs) return;
    const id = window.setInterval(() => { refreshRef.current(undefined, true); }, rotationMs);
    return () => window.clearInterval(id);
  }, [rotationMs]);

  const changeRotation = (ms: number) => {
    setRotationMs(ms);
    try { localStorage.setItem(ROTATION_KEY, String(ms)); } catch {}
  };

  const persistQuote = async (text: string, author: string | null): Promise<boolean> => {
    if (isGuest || !user) {
      const q: UserQuote = { id: crypto.randomUUID(), text, author };
      const next = [q, ...userQuotes];
      setUserQuotes(next);
      localStorage.setItem(GUEST_KEY, JSON.stringify(next));
      return true;
    }
    const { data, error } = await supabase.from('user_quotes').insert({ user_id: user.id, text, author }).select().single();
    if (error) { toast.error('Failed to save quote'); return false; }
    setUserQuotes([data as UserQuote, ...userQuotes]);
    return true;
  };

  const addQuote = async () => {
    const text = newText.trim();
    if (!text) return;
    const ok = await persistQuote(text, newAuthor.trim() || null);
    if (!ok) return;
    setNewText(''); setNewAuthor('');
    toast.success('Quote added');
  };

  const isSaved = userQuotes.some(q => q.text === quote.text);

  const saveCurrent = async () => {
    if (isSaved) return;
    const ok = await persistQuote(quote.text, quote.author === 'Unknown' ? null : quote.author);
    if (ok) {
      setQuote(q => ({ ...q, source: 'user' }));
      toast.success('Quote saved to your collection');
    }
  };

  const removeQuote = async (id: string) => {
    if (isGuest || !user) {
      const next = userQuotes.filter(q => q.id !== id);
      setUserQuotes(next);
      localStorage.setItem(GUEST_KEY, JSON.stringify(next));
    } else {
      const { error } = await supabase.from('user_quotes').delete().eq('id', id);
      if (error) { toast.error('Failed to delete'); return; }
      setUserQuotes(userQuotes.filter(q => q.id !== id));
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="glass-card p-5 sm:p-6 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-primary/10 blur-3xl -z-10" />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-display text-primary">
          <Quote className="w-3.5 h-3.5" />
          <span>{quote.source === 'user' ? 'Your Quote' : 'Daily Spark'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={saveCurrent}
            disabled={isSaved}
            aria-label={isSaved ? 'Quote saved' : 'Save this quote'}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-70 disabled:text-primary"
          >
            {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                aria-label="Manage quotes"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Your Quotes</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2">
                  <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                    <Clock className="w-3 h-3" /> Show each quote for
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ROTATION_OPTIONS.map(o => (
                      <button
                        key={o.ms}
                        onClick={() => changeRotation(o.ms)}
                        className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                          rotationMs === o.ms
                            ? 'border-primary text-primary bg-primary/10'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {rotationMs === 0
                      ? 'Quotes change only when you tap refresh.'
                      : 'The next quote appears automatically after this time.'}
                  </p>
                </div>

                <Textarea
                  placeholder="Write a quote that motivates you…"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  rows={3}
                />
                <Input
                  placeholder="Author (optional)"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                />
                <Button onClick={addQuote} className="w-full" disabled={!newText.trim()}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add quote
                </Button>
                <div className="max-h-64 overflow-y-auto space-y-2 pt-2 border-t border-border/40">
                  {userQuotes.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No saved quotes yet. Add one, or tap the bookmark on a quote you like. Saved quotes take priority over AI quotes.
                    </p>
                  ) : userQuotes.map(q => (
                    <div key={q.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/50 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">{q.text}</p>
                        {q.author && <p className="text-[11px] text-muted-foreground mt-0.5">— {q.author}</p>}
                      </div>
                      <button
                        onClick={() => removeQuote(q.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 transition"
                        aria-label="Delete quote"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <button
            onClick={() => refresh()}
            disabled={loading}
            aria-label="Refresh quote"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={quote.text}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-lg sm:text-xl font-display font-semibold leading-snug tracking-tight text-foreground">
            "{quote.text}"
          </p>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {quote.source === 'user' ? <User className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
            <span>{quote.author}</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.section>
  );
}
