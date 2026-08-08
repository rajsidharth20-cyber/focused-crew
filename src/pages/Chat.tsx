import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface Message {
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

export default function Chat() {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const { counts } = useUnreadMessages();
  const [people, setPeople] = useState<Profile[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, Message>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: profiles }, { data: msgs }] = await Promise.all([
      supabase.from("profiles").select("id, username, full_name, avatar_url").neq("id", user.id),
      supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    const latest: Record<string, Message> = {};
    ((msgs as Message[]) ?? []).forEach((m) => {
      const other = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      if (!latest[other]) latest[other] = m;
    });
    setLastMessages(latest);
    setPeople((profiles as Profile[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    load();
    const channel = supabase
      .channel("chat-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

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
                            ? `${last.sender_id === user.id ? "You: " : ""}${last.message}`
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
  const { userId } = useParams<{ userId: string }>();
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
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
    const prev = messages;
    setMessages((list) => list.filter((m) => m.id !== id));
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) {
      setMessages(prev);
      toast.error("Could not delete this message");
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !user || !userId) return;
    setDraft("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: user.id, receiver_id: userId, message: text })
      .select()
      .single();
    inputRef.current?.focus();
    if (error) {
      setDraft(text);
      return;
    }
    setMessages((prev) =>
      prev.some((p) => p.id === (data as Message).id) ? prev : [...prev, data as Message]
    );
    sendPush({
      userIds: [userId],
      category: "direct_messages",
      title: "New message",
      body: text.slice(0, 120),
      url: `/chat/${user.id}`,
      dedupeKey: (data as Message).id,
    });
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
          <Link to={`/u/${other.id}`} className="flex items-center gap-3 min-w-0">
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
                    <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
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
        className="sticky bottom-0 flex items-center gap-2 p-2 border-t border-border/60 bg-background/95 backdrop-blur"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      >
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message"
          className="rounded-full"
          aria-label="Message"
        />
        <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={!draft.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
