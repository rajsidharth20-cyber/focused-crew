import { assertImageFile } from '@/lib/upload-guard';
import { secureImageUpload } from '@/lib/secure-image-upload';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { sendPush } from '@/lib/push';
import { useAuth } from '@/hooks/useAuth';
import { fetchProfiles, memberName, type MemberProfile } from '@/hooks/use-study-groups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/UserAvatar';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useHiddenMessages } from '@/hooks/use-hidden-messages';
import { useLiveStudy } from '@/hooks/use-live-study';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, Bot, ImagePlus, Loader2, Pin, PinOff, Reply, Send, Smile, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { processGroupMessage } from '@/hooks/use-focusbot';

interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  reply_to_id: string | null;
  pinned: boolean;
  created_at: string;
  author_type: string;
}

interface Poll { id: string; message_id: string | null; question: string; status: string }
interface PollOption { id: string; poll_id: string; label: string; position: number }
interface PollVote { poll_id: string; option_id: string; user_id: string }

const EMOJIS = ['😀','😂','🥲','😍','🤔','😴','😭','🔥','💪','🎯','✅','📚','⏰','☕','🚀','🫡','👍','👏','🙏','💯'];

function ChatImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    supabase.storage
      .from('group-images')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [path]);
  if (!url) return <div className="w-40 h-40 rounded-xl bg-muted animate-pulse" />;
  return <img src={url} alt="Shared in group chat" loading="lazy" className="rounded-xl max-w-[220px]" />;
}

export default function GroupChat() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();

  const [groupName, setGroupName] = useState('');
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [botEnabled, setBotEnabled] = useState(false);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollOptions, setPollOptions] = useState<PollOption[]>([]);
  const [pollVotes, setPollVotes] = useState<PollVote[]>([]);
  const [focusUntil, setFocusUntil] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { isHidden, hide } = useHiddenMessages('group');
  const { isUserLive } = useLiveStudy(Object.keys(profiles));

  const load = useCallback(async () => {
    if (!groupId) return;
    const [{ data: g }, { data: msgs }] = await Promise.all([
      supabase.from('study_groups').select('name').eq('id', groupId).maybeSingle(),
      supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(300),
    ]);
    setGroupName(g?.name ?? 'Group chat');
    const list = (msgs ?? []) as GroupMessage[];
    setMessages(list);
    setProfiles(await fetchProfiles([...new Set(list.filter(m => m.author_type !== 'focusbot').map(m => m.user_id))]));
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadBot = useCallback(async () => {
    if (!groupId || !user) return;
    const [{ data: bot }, { data: pollRows }, { data: sessions }] = await Promise.all([
      supabase.from('bot_instances').select('enabled').eq('group_id', groupId).eq('bot_type', 'focusbot').maybeSingle(),
      supabase.from('bot_polls').select('id,message_id,question,status').eq('group_id', groupId).order('created_at', { ascending: false }).limit(30),
      supabase.from('bot_focus_sessions').select('ends_at').eq('group_id', groupId).eq('active', true).order('ends_at', { ascending: false }).limit(1),
    ]);
    setBotEnabled(Boolean(bot?.enabled));
    setPolls(pollRows ?? []);
    setFocusUntil(sessions?.[0]?.ends_at ?? null);
    const ids = (pollRows ?? []).map(p => p.id);
    if (!ids.length) { setPollOptions([]); setPollVotes([]); return; }
    const [{ data: options }, { data: votes }] = await Promise.all([
      supabase.from('bot_poll_options').select('id,poll_id,label,position').in('poll_id', ids),
      supabase.from('bot_poll_votes').select('poll_id,option_id,user_id').in('poll_id', ids),
    ]);
    setPollOptions(options ?? []);
    setPollVotes(votes ?? []);
  }, [groupId, user]);

  useEffect(() => {
    loadBot();
    const interval = window.setInterval(() => { setNow(Date.now()); loadBot(); }, 15000);
    return () => window.clearInterval(interval);
  }, [loadBot]);

  const vote = async (pollId: string, optionId: string) => {
    if (!user) return;
    const existing = pollVotes.find(v => v.poll_id === pollId && v.user_id === user.id);
    const result = existing
      ? await supabase.from('bot_poll_votes').update({ option_id: optionId }).eq('poll_id', pollId).eq('user_id', user.id)
      : await supabase.from('bot_poll_votes').insert({ poll_id: pollId, option_id: optionId, user_id: user.id });
    if (result.error) toast.error(result.error.message);
    else await loadBot();
  };

  useEffect(() => {
    if (!groupId || !user) return;
    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        async payload => {
          const msg = payload.new as GroupMessage;
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
          if (msg.author_type !== 'focusbot' && !profilesHas(msg.user_id)) {
            const p = await fetchProfiles([msg.user_id]);
            setProfiles(prev => ({ ...prev, ...p }));
          }
          if (msg.user_id !== user.id && document.visibilityState !== 'visible') {
            notify(groupNameRef.current, msg.content ?? 'Sent an image');
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        payload => {
          const msg = payload.new as GroupMessage;
          setMessages(prev => prev.map(m => (m.id === msg.id ? msg : m)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        payload => {
          setMessages(prev => prev.filter(m => m.id !== (payload.old as GroupMessage).id));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, user]);

  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const profilesHas = (id: string) => Boolean(profilesRef.current[id]);
  const groupNameRef = useRef(groupName);
  groupNameRef.current = groupName;

  const notify = (title: string, body: string) => {
    toast(title, { description: body });
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  };

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const visibleMessages = useMemo(() => messages.filter(m => !isHidden(m.id)), [messages, isHidden]);
  const pinned = useMemo(() => messages.filter(m => m.pinned && !isHidden(m.id)), [messages, isHidden]);
  const byId = useMemo(() => {
    const map: Record<string, GroupMessage> = {};
    messages.forEach(m => {
      map[m.id] = m;
    });
    return map;
  }, [messages]);

  const notifyGroup = async (messageId: string, content: string, replyId: string | null) => {
    if (!groupId || !user) return;
    const { data: members } = await supabase
      .from('group_members').select('user_id').eq('group_id', groupId);
    const ids = (members ?? []).map((m: any) => m.user_id).filter((id: string) => id !== user.id);
    if (!ids.length) return;

    const replyTarget = replyId ? byId[replyId]?.user_id : null;
    const mentioned = ids.filter((id: string) => id === replyTarget);
    const rest = ids.filter((id: string) => !mentioned.includes(id));

    if (mentioned.length) {
      sendPush({
        userIds: mentioned,
        category: 'mentions',
        title: 'You were replied to',
        body: content.slice(0, 120) || 'Sent a photo',
        url: `/groups/${groupId}/chat`,
        dedupeKey: messageId,
      });
    }
    if (rest.length) {
      sendPush({
        userIds: rest,
        category: 'group_messages',
        title: 'New group message',
        body: content.slice(0, 120) || 'Sent a photo',
        url: `/groups/${groupId}/chat`,
        dedupeKey: messageId,
      });
    }
  };

  const send = async () => {
    if (!groupId || !user || !text.trim()) return;
    const content = text.trim();
    setText('');
    const replyId = replyTo?.id ?? null;
    setReplyTo(null);
    const { data: inserted, error } = await supabase.from('group_messages').insert({
      group_id: groupId,
      user_id: user.id,
      content,
      reply_to_id: replyId,
    }).select('id').single();
    if (error) {
      toast.error(error.message);
      setText(content);
      return;
    }
    notifyGroup(inserted?.id ?? crypto.randomUUID(), content, replyId);
  };

  const sendImage = async (file: File) => {
    if (!groupId || !user) return;
    try { assertImageFile(file); } catch (err: any) { toast.error(err.message); return; }
    setUploading(true);
    let path: string;
    try {
      path = await secureImageUpload({ bucket: 'group-images', file, groupId });
    } catch (upErr: any) {
      setUploading(false);
      toast.error(upErr?.message ?? 'Image upload failed');
      return;
    }
    const { error } = await supabase.from('group_messages').insert({
      group_id: groupId,
      user_id: user.id,
      image_url: path,
      reply_to_id: replyTo?.id ?? null,
    });
    setUploading(false);
    setReplyTo(null);
    if (error) toast.error(error.message);
  };

  /** Removes the message for the whole group. Authors and group admins are allowed. */
  const deleteForAll = async (id: string) => {
    const prev = messages;
    setMessages(list => list.filter(m => m.id !== id));
    const { error } = await supabase.from('group_messages').delete().eq('id', id);
    if (error) {
      setMessages(prev);
      toast.error('Could not delete this message');
    }
  };

  const togglePin = async (m: GroupMessage) => {
    const { error } = await supabase.rpc('set_group_message_pinned', {
      _message_id: m.id,
      _pinned: !m.pinned,
    });
    if (error) toast.error('Could not update pin');
  };

  if (isGuest || !user) {
    return (
      <div className="min-h-screen bg-background grid place-items-center p-6">
        <Button onClick={() => navigate('/auth')}>Sign in to chat</Button>
      </div>
    );
  }

  return (
    <div
      className="h-[100dvh] bg-background flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="flex items-center gap-2 px-3 py-3 border-b border-border/60 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/groups/${groupId}`)} aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-semibold truncate flex-1">{groupName}</h1>
      </header>

      {pinned.length > 0 && (
        <div className="px-3 py-2 border-b border-border/60 bg-muted/40 shrink-0 space-y-1">
          {pinned.slice(-2).map(m => (
            <div key={m.id} className="flex items-center gap-2 text-xs">
              <Pin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate flex-1">{m.content ?? 'Image'}</span>
              <button onClick={() => togglePin(m)} aria-label="Unpin message">
                <PinOff className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : visibleMessages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No messages yet. Say hello 👋
          </p>
        ) : (
          visibleMessages.map(m => {
            const mine = m.user_id === user.id;
            const parent = m.reply_to_id ? byId[m.reply_to_id] : null;
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                {!mine && (
                  <UserAvatar
                    src={profiles[m.user_id]?.avatar_url}
                    name={memberName(profiles[m.user_id])}
                    className="w-7 h-7 mt-auto"
                    fallbackClassName="text-[10px]"
                    live={isUserLive(m.user_id)}
                  />
                )}
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                <div
                  className={`group max-w-[78%] select-none rounded-2xl px-3 py-2 ${
                    mine
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-card border border-border/60 rounded-bl-md'
                  }`}
                >
                  {!mine && (
                    <p className="text-[11px] font-medium opacity-80 mb-0.5">
                      {memberName(profiles[m.user_id])}
                    </p>
                  )}
                  {parent && (
                    <div className="text-[11px] opacity-70 border-l-2 border-current/40 pl-2 mb-1 truncate">
                      {parent.content ?? 'Image'}
                    </div>
                  )}
                  {m.image_url && <ChatImage path={m.image_url} />}
                  {m.content && (
                    <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] opacity-70 tabular-nums">
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <button
                      className="opacity-60 hover:opacity-100"
                      onClick={() => setReplyTo(m)}
                      aria-label="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="opacity-60 hover:opacity-100"
                      onClick={() => togglePin(m)}
                      aria-label={m.pinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onSelect={() => hide(m.id)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Delete for me
                    </ContextMenuItem>
                    {mine && (
                      <ContextMenuItem onSelect={() => deleteForAll(m.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete for everyone
                      </ContextMenuItem>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border/60 bg-muted/40 text-xs">
          <Reply className="w-3.5 h-3.5 text-primary" />
          <span className="truncate flex-1">{replyTo.content ?? 'Image'}</span>
          <button onClick={() => setReplyTo(null)} aria-label="Cancel reply">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div
        className="flex items-end gap-1.5 p-2 border-t border-border/60 shrink-0"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Emoji">
              <Smile className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2">
            <div className="grid grid-cols-7 gap-1">
              {EMOJIS.map(e => (
                <button
                  key={e}
                  className="text-xl rounded hover:bg-muted p-1"
                  onClick={() => setText(t => t + e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Send image"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) sendImage(f);
            e.target.value = '';
          }}
        />
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message"
          className="flex-1 rounded-full"
        />
        <Button size="icon" className="rounded-full" onClick={send} disabled={!text.trim()} aria-label="Send">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
