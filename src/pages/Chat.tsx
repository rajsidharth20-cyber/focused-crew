import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2, Send, MessagesSquare, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

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
      className="min-h-screen bg-background flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <header className="flex items-center gap-2 px-3 py-3 border-b border-border/60 sticky top-0 bg-background/90 backdrop-blur z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">Chats</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">No other members yet.</p>
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
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={p.avatar_url ?? undefined} alt={displayName(p)} />
                      <AvatarFallback>{displayName(p).charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
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
            <Avatar className="w-9 h-9">
              <AvatarImage src={other.avatar_url ?? undefined} alt={displayName(other)} />
              <AvatarFallback>{displayName(other).charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <h1 className="font-semibold truncate">{displayName(other)}</h1>
          </Link>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">
            No messages yet — say hello.
          </p>
        ) : (
          messages.map((m) => {
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
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3 py-2 shadow-sm",
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
