import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Loader2, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { callFocusBot } from '@/hooks/use-focusbot';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BotMessage { id: string; message: string; bot_role: string | null; created_at: string }

export default function FocusBotChat() {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('messages').select('id,message,bot_role,created_at').eq('sender_id', user.id).eq('receiver_id', user.id).eq('bot_type', 'focusbot').order('created_at');
    setMessages((data ?? []) as BotMessage[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase.channel(`focusbot-private-${user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, payload => {
      const next = payload.new as BotMessage & { bot_type?: string };
      if (next.bot_type === 'focusbot') setMessages(current => current.some(item => item.id === next.id) ? current : [...current, next]);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, user]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setDraft('');
    setSending(true);
    try { await callFocusBot({ action: 'private_chat', message }); await load(); }
    catch (error) { setDraft(message); toast.error(error instanceof Error ? error.message : 'FocusBot is unavailable.'); }
    finally { setSending(false); }
  };

  if (isGuest || !user) return <div className="min-h-screen grid place-items-center"><Button onClick={() => navigate('/auth')}>Sign in</Button></div>;

  return <div className="h-[100dvh] bg-background flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
    <header className="flex items-center gap-3 px-3 py-2 border-b border-border/60">
      <Button variant="ghost" size="icon" onClick={() => navigate('/social')} aria-label="Back"><ArrowLeft className="w-5 h-5" /></Button>
      <span className="w-9 h-9 rounded-full bg-primary/10 text-primary grid place-items-center"><Bot className="w-5 h-5" /></span>
      <div className="min-w-0"><h1 className="font-semibold leading-tight">FocusBot</h1><p className="text-[11px] text-muted-foreground flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Private study assistant</p></div>
    </header>
    <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border/50 bg-muted/30">This conversation starts only when you message FocusBot. Your normal private chats are never monitored.</div>
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
      {loading ? <div className="grid place-items-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div> : messages.length === 0 ? <div className="text-center py-14"><Bot className="w-10 h-10 mx-auto text-primary mb-3" /><p className="font-medium">What are you working on?</p><p className="text-sm text-muted-foreground mt-1">Ask for a study plan, explanation, or accountability check.</p></div> : messages.map(item => {
        const mine = item.bot_role === 'user';
        return <div key={item.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[82%] rounded-2xl px-3 py-2', mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border/60 rounded-bl-sm')}><p className="text-sm whitespace-pre-wrap break-words">{item.message}</p><p className="text-[10px] opacity-65 mt-1">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div></div>;
      })}
      {sending && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> FocusBot is thinking…</div>}
      <div ref={bottomRef} />
    </div>
    <form onSubmit={send} className="flex gap-2 p-2 border-t border-border/60" style={{ paddingBottom: 'calc(.5rem + env(safe-area-inset-bottom))' }}><Input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Message FocusBot" className="rounded-full" /><Button type="submit" size="icon" className="rounded-full shrink-0" disabled={!draft.trim() || sending}><Send className="w-4 h-4" /></Button></form>
  </div>;
}