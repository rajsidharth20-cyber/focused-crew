import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { ArrowLeft, Bot, Loader2, Send, Sparkles, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getEffectiveToday } from '@/lib/day-boundary';
import { BottomNav } from '@/components/shell/BottomNav';

interface CopilotAction {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
}

interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: CopilotAction[];
}

const ACTION_LABEL: Record<string, string> = {
  add_subject: 'Added subject',
  add_objective: 'Added task',
  update_objective: 'Updated task',
  delete_objective: 'Deleted task',
  add_commitment: 'Added commitment',
  delete_commitment: 'Deleted commitment',
  add_event: 'Added event',
  update_event: 'Updated event',
  delete_event: 'Deleted event',
  add_weekly_target: 'Added weekly target',
  update_weekly_target: 'Updated weekly target',
  delete_weekly_target: 'Deleted weekly target',
  save_daily_note: 'Saved daily note',
};

const SUGGESTIONS = [
  'Plan my day around my classes',
  'Add a Physics revision task for tomorrow at high priority',
  'Add an event: Maths exam on Friday 9am',
  'Analyse my last 7 days and tell me what to fix',
];

function describeAction(a: CopilotAction) {
  const label = ACTION_LABEL[a.name] ?? a.name;
  const args = a.args as Record<string, any>;
  const detail = args.task || args.title || args.target || args.name || args.content || '';
  return `${label}${detail ? `: ${String(detail).slice(0, 60)}` : ''}`;
}

const Copilot = () => {
  const { user, isGuest } = useAuth();
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    if (isGuest || !user) {
      toast.error('Sign in to use Copilot — it needs your synced data.');
      return;
    }
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-copilot', {
        body: {
          messages: next.map(m => ({ role: m.role, content: m.content })),
          today: getEffectiveToday(),
          localTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const actions: CopilotAction[] = (data as any)?.actions ?? [];
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: (data as any)?.reply || '…', actions },
      ]);
      if (actions.some(a => a.ok)) {
        toast.success('Your planner was updated', {
          description: 'Pull to refresh other tabs to see the changes.',
        });
      }
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      toast.error(msg);
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-x-hidden app-surface flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="aurora animate-float" style={{ width: 340, height: 340, background: 'hsl(var(--primary) / 0.18)', top: -120, left: -100 }} />
      </div>

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="press -ml-1 p-1.5 rounded-xl hover:bg-secondary/60">
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-[17px] font-bold tracking-tight leading-tight">Copilot</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Ask it to analyse or change your plan</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 pb-40 space-y-3">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 text-center">
            <span className="w-11 h-11 rounded-2xl bg-gradient-primary grid place-items-center mx-auto">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </span>
            <h2 className="mt-3 text-sm font-semibold">Your planner, on autopilot</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Copilot can read your objectives, commitments, events, targets and study sessions — and add, edit or remove them for you.
            </p>
            <div className="mt-4 grid gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="press text-left text-[12.5px] rounded-2xl border border-border/60 px-3.5 py-2.5 hover:bg-secondary/50"
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[85%] rounded-3xl rounded-br-lg bg-gradient-primary text-primary-foreground px-4 py-2.5 text-[13.5px] leading-relaxed'
                  : 'max-w-[92%] glass-card px-4 py-3'
              }
            >
              {m.role === 'assistant' ? (
                <>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-[13.5px] prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-headings:text-sm">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-border/50 space-y-1">
                      {m.actions.map((a, j) => (
                        <div key={j} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                          <Wand2 className={`w-3 h-3 shrink-0 ${a.ok ? 'text-primary' : 'text-destructive'}`} />
                          <span className="truncate">{describeAction(a)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                m.content
              )}
            </div>
          </motion.div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground px-1">
            <Bot className="w-3.5 h-3.5" />
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Working on it…
          </div>
        )}
        <div ref={endRef} />
      </main>

      <form
        onSubmit={e => { e.preventDefault(); send(input); }}
        className="fixed bottom-[86px] left-0 right-0 z-30 px-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-2 glass-card px-2 py-2 backdrop-blur-xl">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask, or tell it what to change…"
            className="flex-1 bg-transparent px-2.5 text-[13.5px] outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="press w-9 h-9 rounded-2xl bg-gradient-primary grid place-items-center disabled:opacity-40"
            aria-label="Send"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-primary-foreground" />
            )}
          </button>
        </div>
      </form>

      <BottomNav />
    </div>
  );
};

export default Copilot;
