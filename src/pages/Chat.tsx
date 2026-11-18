import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { sendPush } from "@/lib/push";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useHiddenMessages } from "@/hooks/use-hidden-messages";
import { useLiveStudy } from "@/hooks/use-live-study";
import { useSocialResource } from "@/hooks/use-social-resource";
import { onUserEvent } from "@/lib/user-events";
import { useAudioCall } from "@/hooks/use-audio-call";
import {
  ArrowLeft,
  Loader2,
  Send,
  MessagesSquare,
  Check,
  CheckCheck,
  Search,
  Trash2,
  BookOpen,
  Bot,
  ShieldCheck,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChatAttachment } from '@/components/social/ChatAttachment';
import { attachmentLabel, snapshotChatFile, uploadChatAttachment, type ChatAttachment as Attachment } from '@/lib/chat-attachments';
import { Paperclip, X } from 'lucide-react';

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface Message extends Attachment {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

export const displayName = (p: Profile) => p.full_name || p.username || "Pilot";

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(today.getTime() - 86400000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
};

function GuestGate() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
      <MessagesSquare className="w-10 h-10 text-muted-foreground" />
      <p className="text-muted-foreground">Sign in with an account to use chats.</p>
      <Button onClick={() => navigate("/auth")}>Sign in</Button>
    </div>
  );
}

/* ---------------------------- Find people by username ---------------------------- */

function FindPeopleDialog() {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const value = term.trim();
    if (value.length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    const id = setTimeout(async () => {
      const { data } = await supabase.rpc("search_profiles_by_username", { _term: value });
      setResults((data as Profile[]) ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(id);
  }, [term]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Find people by username">
          <Search className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Find people</DialogTitle>
        </DialogHeader>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by exact username"
          aria-label="Username"
        />
        <p className="text-[11px] text-muted-foreground">
          People are only discoverable through their username or a shared public group.
        </p>
        <ul className="max-h-64 overflow-y-auto divide-y divide-border/50">
          {searching && <li className="py-3 text-sm text-muted-foreground">Searching…</li>}
          {!searching && term.trim().length >= 3 && results.length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">No one found with that username.</li>
          )}
          {results.map((p) => (
            <li key={p.id}>
              <Link to={`/chat/${p.id}`} className="flex items-center gap-3 py-2.5">
                <UserAvatar src={p.avatar_url} name={displayName(p)} className="w-9 h-9" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{displayName(p)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">@{p.username}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- Chat list ------------------------------- */

export default function Chat({ embedded = false }: { embedded?: boolean }) {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const { counts } = useUnreadMessages();
  const fetchChats = useCallback(async () => {
    if (!user) return { people: [] as Profile[], lastMessages: {} as Record<string, Message> };
    const [profileResult, messageResult] = await Promise.all([
      supabase.from('profiles').select('id, username, full_name, avatar_url').neq('id', user.id),
      supabase.from('messages').select('id, sender_id, receiver_id, message, created_at, read_at, attachment_path, attachment_name, attachment_type, attachment_size')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(500),
    ]);
    if (profileResult.error || messageResult.error) throw profileResult.error || messageResult.error;
    const lastMessages: Record<string, Message> = {};
    (messageResult.data ?? []).forEach(m => {
      const other = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      if (!lastMessages[other]) lastMessages[other] = m;
    });
    return { people: (profileResult.data ?? []) as Profile[], lastMessages };
  }, [user?.id]);
  const { data: state, setData, loading } = useSocialResource(user?.id, 'chats', { people: [] as Profile[], lastMessages: {} as Record<string, Message> }, fetchChats);
  const { people, lastMessages } = state;
  useEffect(() => {
    if (!user) return;
    return onUserEvent(user.id, 'messages', payload => {
      const row = payload.new as unknown as Message;
      if (payload.eventType === 'DELETE') {
        const id = (payload.old as { id?: string }).id;
        setData(prev => ({ ...prev, lastMessages: Object.fromEntries(Object.entries(prev.lastMessages).filter(([, m]) => m.id !== id)) }));
        return;
      }
      if (!row.id || (row.sender_id !== user.id && row.receiver_id !== user.id)) return;
      const other = row.sender_id === user.id ? row.receiver_id : row.sender_id;
      setData(prev => {
        const last = prev.lastMessages[other];
        if (last && last.id !== row.id && last.created_at > row.created_at) return prev;
        return { ...prev, lastMessages: { ...prev.lastMessages, [other]: row } };
      });
      if (!people.some(p => p.id === other)) {
        void supabase.from('profiles').select('id, username, full_name, avatar_url').eq('id', other).maybeSingle().then(({ data }) => {
          if (data) setData(prev => ({ ...prev, people: [...prev.people.filter(p => p.id !== other), data] }));
        });
      }
    });
  }, [user?.id, setData, people]);

  const { isUserLive } = useLiveStudy(people.map((p) => p.id));

  const sorted = useMemo(() => {
    return [...people].sort((a, b) => {
      const ta = lastMessages[a.id]?.created_at ?? "";
      const tb = lastMessages[b.id]?.created_at ?? "";
      if (ta && tb) return tb.localeCompare(ta);
      if (ta) return -1;
      if (tb) return 1;
      return displayName(a).localeCompare(displayName(b));
    });
  }, [people, lastMessages]);

  if (isGuest || !user) return <GuestGate />;

  return (
    <div
      className={embedded ? "flex flex-col flex-1 min-h-0" : "min-h-screen bg-background flex flex-col"}
      style={embedded ? undefined : { paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border/60 sticky top-0 bg-background/90 backdrop-blur z-10">
        {!embedded && (
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <h1 className="text-sm font-semibold flex-1">Chats</h1>
        <FindPeopleDialog />
      </header>


      <div className="flex-1 overflow-y-auto p-2">
        <Link to="/focusbot" className="flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors hover:bg-muted/60 border-b border-border/50">
          <span className="w-12 h-12 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0"><Bot className="w-6 h-6" /></span>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><span className="font-medium">FocusBot</span><ShieldCheck className="w-3.5 h-3.5 text-primary" /></div><p className="text-sm text-muted-foreground truncate">Your private study assistant</p></div>
        </Link>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">
            No chats yet. Search a username or join a public group to find people.
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {sorted.map((p) => {
              const last = lastMessages[p.id];
              const unread = counts[p.id] ?? 0;
              return (
                <li key={p.id}>
                  <Link
                    to={`/chat/${p.id}`}
                    className="flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors hover:bg-muted/60"
                  >
                    <UserAvatar
                      src={p.avatar_url}
                      name={displayName(p)}
                      className="w-12 h-12"
                      live={isUserLive(p.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium truncate">{displayName(p)}</span>
                        {last && (
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {timeLabel(last.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground truncate">
                          {last
                            ? `${last.sender_id === user.id ? "You: " : ""}${attachmentLabel(last)}`
                            : "Tap to start chatting"}
                        </p>
                        {unread > 0 && (
                          <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold grid place-items-center">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Chat thread ------------------------------ */

export function ChatThread() {
  const { call, start: startCall } = useAudioCall();
  const { userId } = useParams<{ userId: string }>();
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);
  const selectionVersion = useRef(0);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    selectionVersion.current++;
    setAttachment(null); setPreparing(false); setDraft('');
    return () => { selectionVersion.current++; };
  }, [userId, user?.id]);
  useEffect(() => {
    if (!attachment || !attachment.type.startsWith('image/') || !['image/jpeg','image/png','image/webp','image/gif'].includes(attachment.type)) { setPreview(''); return; }
    const url = URL.createObjectURL(attachment); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);
  const selectFile = async (source?: File) => {
    if (!source) return;
    const version = ++selectionVersion.current;
    setPreparing(true); setAttachment(null);
    try {
      const copy = await snapshotChatFile(source);
      if (version === selectionVersion.current) setAttachment(copy);
    } catch (error) {
      if (version === selectionVersion.current) toast.error(error instanceof Error ? error.message : 'Could not open this file');
    } finally { if (version === selectionVersion.current) setPreparing(false); }
  };
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isHidden, hide } = useHiddenMessages("dm");
  const { isUserLive } = useLiveStudy(userId ? [userId] : []);
  const otherLive = userId ? isUserLive(userId) : false;

  const markRead = useCallback(async () => {
    if (!user || !userId) return;
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("receiver_id", user.id)
      .eq("sender_id", userId)
      .is("read_at", null);
  }, [user, userId]);

  useEffect(() => {
    if (!user || !userId) return;
    let cancelled = false;

    const load = async () => {
      const [{ data: profile }, { data }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("messages")
          .select("*")
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`
          )
          .order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      setOther((profile as Profile) ?? null);
      setMessages((data as Message[]) ?? []);
      setLoading(false);
      markRead();
    };
    load();

    const channel = supabase
      .channel(`thread-${user.id}-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        const m = (payload.new ?? payload.old) as Message;
        const inThread =
          (m.sender_id === user.id && m.receiver_id === userId) ||
          (m.sender_id === userId && m.receiver_id === user.id);
        if (!inThread) return;
        if (payload.eventType === "DELETE") {
          setMessages((prev) => prev.filter((p) => p.id !== m.id));
          return;
        }
        setMessages((prev) => {
          const idx = prev.findIndex((p) => p.id === m.id);
          if (idx === -1) return [...prev, m];
          const next = [...prev];
          next[idx] = m;
          return next;
        });
        if (m.receiver_id === user.id && !m.read_at) markRead();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, userId, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !isHidden(m.id)),
    [messages, isHidden]
  );

  /** Removes the message for both people (Telegram-style "delete for everyone"). */
  const deleteForAll = async (id: string) => {
    const path = messages.find(m => m.id === id)?.attachment_path;
    const prev = messages;
    setMessages((list) => list.filter((m) => m.id !== id));
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) {
      setMessages(prev);
      toast.error("Could not delete this message");
    } else if (path) {
      await supabase.storage.from('chat-attachments').remove([path]);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if ((!text && !attachment) || !user || !userId || sending || preparing) return;
    const version = selectionVersion.current;
    setSending(true);
    let uploaded: Attachment | undefined;
    let saved = false;
    try {
      if (attachment) uploaded = await uploadChatAttachment(user.id, userId, attachment);
      const { data, error } = await supabase.from('messages')
        .insert({ sender_id: user.id, receiver_id: userId, message: text, ...uploaded }).select().single();
      if (error || !data) throw error;
      saved = true;
      if (version === selectionVersion.current) {
        setDraft(''); setAttachment(null);
        setMessages(prev => prev.some(p => p.id === data.id) ? prev : [...prev, data]);
        inputRef.current?.focus();
      }
      void sendPush({ userIds: [userId], category: 'direct_messages', title: 'New message', body: attachmentLabel(data).slice(0, 120), url: `/chat/${user.id}`, dedupeKey: data.id });
    } catch (error) {
      if (!saved && uploaded?.attachment_path) await supabase.storage.from('chat-attachments').remove([uploaded.attachment_path]);
      toast.error(error instanceof Error ? error.message : 'Could not send this message. Please try again.');
    } finally { setSending(false); }
  };

  if (isGuest || !user) return <GuestGate />;

  let lastDay = "";

  return (
    <div
      className="min-h-screen bg-muted/30 flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <header className="flex items-center gap-2 px-2 py-2 border-b border-border/60 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate("/chat")} aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        {other && (
          <Link to={`/u/${other.id}`} className="flex items-center gap-3 min-w-0 flex-1">
            <UserAvatar
              src={other.avatar_url}
              name={displayName(other)}
              className="w-9 h-9"
              live={otherLive}
            />
            <div className="min-w-0">
              <h1 className="font-semibold truncate leading-tight">{displayName(other)}</h1>
              {otherLive && (
                <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> Studying now
                </span>
              )}
            </div>
          </Link>
        )}
        {other && <Button variant="ghost" size="icon" aria-label="Start audio call" title="Start audio study call" disabled={!!call} onClick={() => startCall(other)}><Phone className="w-5 h-5" /></Button>}
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : visibleMessages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">
            No messages yet — say hello.
          </p>
        ) : (
          visibleMessages.map((m) => {
            const mine = m.sender_id === user.id;
            const day = dayLabel(m.created_at);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] px-3 py-1 rounded-full bg-background/80 text-muted-foreground border border-border/50">
                      {day}
                    </span>
                  </div>
                )}
                <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3 py-2 shadow-sm select-none",
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card text-card-foreground border border-border/50 rounded-bl-sm"
                    )}
                  >
                    {m.attachment_path && <ChatAttachment attachment={m} />}
                    {m.message && <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>}
                    <div
                      className={cn(
                        "flex items-center gap-1 justify-end mt-0.5 text-[10px]",
                        mine ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}
                    >
                      <span>{timeLabel(m.created_at)}</span>
                      {mine &&
                        (m.read_at ? (
                          <CheckCheck className="w-3 h-3" />
                        ) : (
                          <Check className="w-3 h-3" />
                        ))}
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
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={send}
        className="sticky bottom-0 flex flex-wrap items-center gap-2 p-2 border-t border-border/60 bg-background/95 backdrop-blur"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      >
        {(attachment || preparing) && <div className="w-full flex items-center gap-2 min-w-0">
          {preparing ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : preview ? <img src={preview} alt="Selected photo" className="w-12 h-12 object-cover rounded-md" /> : <Paperclip className="w-5 h-5 text-muted-foreground" />}
          <span className="text-sm truncate flex-1">{preparing ? 'Preparing attachment…' : attachment?.name}</span>
          <Button type="button" size="icon" variant="ghost" disabled={sending} aria-label="Remove attachment" onClick={() => { selectionVersion.current++; setAttachment(null); setPreparing(false); }}><X className="w-4 h-4" /></Button>
        </div>}
        <input ref={pickerRef} type="file" className="hidden" aria-label="Choose photo or file" onChange={e => { void selectFile(e.target.files?.[0]); e.target.value = ''; }} />
        <Button type="button" variant="ghost" size="icon" className="shrink-0" disabled={sending || preparing} aria-label="Attach photo or file" title="Attach photo or file" onClick={() => pickerRef.current?.click()}><Paperclip className="w-5 h-5" /></Button>
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message"
          className="rounded-full flex-1 min-w-0"
          disabled={sending}
          aria-label="Message"
        />
        <Button type="submit" size="icon" aria-label="Send message" className="rounded-full shrink-0" disabled={(!draft.trim() && !attachment) || preparing || sending}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
}
