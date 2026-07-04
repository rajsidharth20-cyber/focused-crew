import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, RefreshCw, Sparkles, Plus, Trash2, User } from 'lucide-react';
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
const FALLBACK: DisplayQuote = { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn', source: 'ai' };

export function QuoteCard() {
  const { user, isGuest } = useAuth();
  const { theme } = useTheme();
  const [quote, setQuote] = useState<DisplayQuote>(FALLBACK);
  const [loading, setLoading] = useState(false);
  const [userQuotes, setUserQuotes] = useState<UserQuote[]>([]);
  const [open, setOpen] = useState(false);
  const [newText, setNewText] = useState('');
  const [newAuthor, setNewAuthor] = useState('');

  const loadUserQuotes = useCallback(async () => {
    if (isGuest || !user) {
      try {
        const raw = localStorage.getItem(GUEST_KEY);
        setUserQuotes(raw ? JSON.parse(raw) : []);
      } catch { setUserQuotes([]); }
      return [];
    }
    const { data } = await supabase.from('user_quotes').select('*').order('created_at', { ascending: false });
    const list = (data ?? []) as UserQuote[];
    setUserQuotes(list);
    return list;
  }, [user, isGuest]);

  const fetchAIQuote = useCallback(async (): Promise<DisplayQuote> => {
    const { data, error } = await supabase.functions.invoke('daily-quote', { body: { theme } });
    if (error || !data?.text) throw error ?? new Error('No quote');
    return { text: data.text, author: data.author || 'Unknown', source: 'ai' };
  }, [theme]);

  const refresh = useCallback(async (list?: UserQuote[]) => {
    setLoading(true);
    try {
      const pool = list ?? userQuotes;
      if (pool.length > 0) {
        // User quotes take priority - pick random, avoid repeating current if possible
        const filtered = pool.length > 1 ? pool.filter(q => q.text !== quote.text) : pool;
        const pick = filtered[Math.floor(Math.random() * filtered.length)];
        setQuote({ text: pick.text, author: pick.author || 'You', source: 'user' });
      } else {
        const q = await fetchAIQuote();
        setQuote(q);
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not fetch a new quote');
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

  const addQuote = async () => {
    const text = newText.trim();
    if (!text) return;
    const author = newAuthor.trim() || null;
    if (isGuest || !user) {
      const q: UserQuote = { id: crypto.randomUUID(), text, author };
      const next = [q, ...userQuotes];
      setUserQuotes(next);
      localStorage.setItem(GUEST_KEY, JSON.stringify(next));
    } else {
      const { data, error } = await supabase.from('user_quotes').insert({ user_id: user.id, text, author }).select().single();
      if (error) { toast.error('Failed to save quote'); return; }
      setUserQuotes([data as UserQuote, ...userQuotes]);
    }
    setNewText(''); setNewAuthor('');
    toast.success('Quote added');
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
                      No quotes yet. Add one and it will take priority over AI quotes.
                    </p>
                  ) : userQuotes.map(q => (
                    <div key={q.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/50 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">{q.text}</p>
                        {q.author && <p className="text-[11px] text-muted-foreground mt-0.5">— {q.author}</p>}
                      </div>
                      <button
                        onClick={() => removeQuote(q.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"
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
