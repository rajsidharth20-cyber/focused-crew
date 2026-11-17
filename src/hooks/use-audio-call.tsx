import { sendPush } from '@/lib/push';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { onUserEvent } from '@/lib/user-events';
import { AudioCallController, type AudioCall, type CallPeer, type CallSignal } from '@/lib/audio-call';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { UserAvatar } from '@/components/UserAvatar';
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

const CallContext = createContext<{ call: AudioCall | null; start: (peer: CallPeer) => void }>({ call: null, start: () => {} });
export const useAudioCall = () => useContext(CallContext);
function Duration({ start }: { start: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  return <span className="font-mono tabular-nums">{Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}</span>;
}

export function AudioCallProvider({ children }: { children: React.ReactNode }) {
  const { user, isGuest } = useAuth();
  const [call, setCall] = useState<AudioCall | null>(null);
  const [playBlocked, setPlayBlocked] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const controller = useRef<AudioCallController | null>(null);
  useEffect(() => {
    if (!user || isGuest) return;
    let active = true;
    const owner = user.id;
    const engine = new AudioCallController({
      send: async (peer, id, kind, payload = {}) => {
        const { error } = await supabase.rpc('send_audio_call_signal', { _peer: peer, _call_id: id, _kind: kind, _payload: JSON.parse(JSON.stringify(payload)) });
        if (error) throw error;
        // Wake the friend's phone when the app is closed; the server verifies this saved offer.
        if (kind === 'offer') void sendPush({ category: 'calls', userIds: [peer], sourceId: id, title: 'Incoming call', body: 'Incoming audio call', url: '/chat', dedupeKey: id }).catch(() => {});
      },
      allowed: async peer => { const { data, error } = await supabase.rpc('can_audio_call', { _peer: peer }); if (error) throw error; return data === true; },
      profile: async peer => {
        const { data, error } = await supabase.from('profiles').select('id,full_name,username,avatar_url').eq('id', peer).single();
        if (error || !data) throw new Error('Could not find this friend.'); return data;
      },
      change: next => { if (active) setCall(next); },
      error: message => { if (active) toast.error(message); },
      remote: stream => {
        const player = audio.current; if (!player) return;
        player.srcObject = stream;
        if (active) setPlayBlocked(false);
        if (stream) void player.play().catch(() => { if (active) setPlayBlocked(true); });
      },
    });
    controller.current = engine;
    // Realtime is the fast path; a small inbox recovery catches subscription/reconnection gaps.
    const seen = new Set<string>();
    const consume = (row: Record<string, unknown>) => {
      if (!active || row.receiver_id !== owner || typeof row.id !== 'string' || seen.has(row.id)) return;
      if (typeof row.created_at !== 'string' || Date.now() - Date.parse(row.created_at) > 45000) return;
      seen.add(row.id); if (seen.size > 300) seen.delete(seen.values().next().value ?? '');
      void engine.receive(row as unknown as CallSignal).then(() => {
        if (active) void supabase.from('audio_call_signals').delete().eq('id', row.id as string);
      });
    };
    const stop = onUserEvent(owner, 'audio_call_signals', event => { if (event.eventType === 'INSERT') consume(event.new); });
    let fetching = false;
    const recover = async () => {
      if (!active || fetching || document.visibilityState === 'hidden') return;
      fetching = true;
      try {
        const { data } = await supabase.from('audio_call_signals').select('*').eq('receiver_id', owner)
          .gt('created_at', new Date(Date.now() - 45000).toISOString()).order('created_at').limit(150);
        if (active) data?.forEach(row => consume(row as unknown as Record<string, unknown>));
      } finally { fetching = false; }
    };
    void recover();
    const interval = setInterval(() => { void recover(); }, 10000);
    const resume = () => { void recover(); };
    const leave = () => engine.end();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pagehide', leave);
    return () => {
      active = false; engine.dispose(); stop(); clearInterval(interval);
      document.removeEventListener('visibilitychange', resume); window.removeEventListener('pagehide', leave);
      if (controller.current === engine) controller.current = null;
      setCall(null);
    };
  }, [user?.id, isGuest]);
  const name = call?.peer.full_name || call?.peer.username || 'Friend';
  const incoming = call?.incoming && call.state === 'ringing';
  const terminal = call && ['ended', 'rejected', 'busy'].includes(call.state);
  return <CallContext.Provider value={{ call, start: peer => { void controller.current?.start(peer); } }}>
    {children}
    <audio ref={audio} autoPlay className="hidden" />
    <Dialog open={!!incoming} onOpenChange={open => { if (!open && incoming) controller.current?.end(true); }}>
      <DialogContent className="max-w-sm" onPointerDownOutside={event => event.preventDefault()}>
        <DialogHeader><DialogTitle>Incoming audio call</DialogTitle><DialogDescription>{name} is calling you.</DialogDescription></DialogHeader>
        <div className="flex justify-center"><UserAvatar src={call?.peer.avatar_url} name={name} className="w-16 h-16" /></div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="destructive" onClick={() => controller.current?.end(true)}><PhoneOff className="w-4 h-4 mr-2" />Decline</Button>
          <Button onClick={() => { void controller.current?.accept(); }}><Phone className="w-4 h-4 mr-2" />Accept</Button>
        </div>
      </DialogContent>
    </Dialog>
    {call && !incoming && <section role="region" aria-label="Audio call" className="fixed bottom-24 left-3 right-3 z-40 mx-auto max-w-lg rounded-lg border border-border bg-card text-card-foreground shadow-lg p-3">
      <div className="flex items-center gap-3">
        <UserAvatar src={call.peer.avatar_url} name={name} className="w-10 h-10" />
        <div className="flex-1 min-w-0"><p className="truncate text-sm font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground" aria-live="polite">{call.state === 'connected' && call.connectedAt ? <Duration start={call.connectedAt} /> : ({ calling: call.incoming ? 'Connecting…' : 'Calling…', ringing: 'Ringing…', ended: 'Call ended', rejected: 'Call declined', busy: 'Friend is busy', connected: 'Connected' }[call.state])}</p>
        </div>
        {!terminal && <>
          {call.state === 'connected' && <Button variant="outline" size="icon" aria-label={call.muted ? 'Unmute microphone' : 'Mute microphone'} title={call.muted ? 'Unmute microphone' : 'Mute microphone'} onClick={() => controller.current?.mute()}>{call.muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}</Button>}
          <Button variant="destructive" size="icon" aria-label="End call" title="End call" onClick={() => controller.current?.end()}><PhoneOff className="w-4 h-4" /></Button>
        </>}
      </div>
      {playBlocked && !terminal && <Button variant="outline" className="w-full mt-2" onClick={() => { void audio.current?.play().then(() => setPlayBlocked(false)).catch(() => toast.error('Please enable audio playback in this browser.')); }}><Volume2 className="w-4 h-4 mr-2" />Play call audio</Button>}
    </section>}
  </CallContext.Provider>;
}