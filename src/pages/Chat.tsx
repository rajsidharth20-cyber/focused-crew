import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Loader2, Send, MessagesSquare } from "lucide-react";
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
}

const displayName = (p: Profile) => p.full_name || p.username || "Pilot";

export default function Chat() {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [active, setActive] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .neq("id", user.id)
      .then(({ data }) => {
        setContacts((data as Profile[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (!user || !active) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${active.id}),and(sender_id.eq.${active.id},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });
      if (!cancelled) setMessages((data as Message[]) ?? []);
    };
    load();

    const channel = supabase
      .channel(`messages-${user.id}-${active.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          const inThread =
            (m.sender_id === user.id && m.receiver_id === active.id) ||
            (m.sender_id === active.id && m.receiver_id === user.id);
          if (!inThread) return;
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !user || !active) return;
    setSending(true);
    setDraft("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: user.id, receiver_id: active.id, message: text })
      .select()
      .single();
    setSending(false);
    inputRef.current?.focus();
    if (error) {
      setDraft(text);
      return;
    }
    setMessages((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data as Message]));
  };

  if (isGuest || !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <MessagesSquare className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Sign in with an account to use messages.</p>
        <Button onClick={() => navigate("/auth")}>Sign in</Button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/60 sticky top-0 bg-background/90 backdrop-blur z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (active ? setActive(null) : navigate("/"))}
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        {active ? (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="w-8 h-8">
              <AvatarImage src={active.avatar_url ?? undefined} alt={displayName(active)} />
              <AvatarFallback>{displayName(active).charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <h1 className="font-semibold truncate">{displayName(active)}</h1>
          </div>
        ) : (
          <h1 className="font-semibold">Messages</h1>
        )}
      </header>

      {!active ? (
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              No other members yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {contacts.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setActive(c)}
                    className="w-full flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 text-left transition-colors hover:bg-muted/60"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={c.avatar_url ?? undefined} alt={displayName(c)} />
                      <AvatarFallback>{displayName(c).charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium truncate">{displayName(c)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-2 p-4">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-10">
                  No messages yet — say hello.
                </p>
              )}
              {messages.map((m) => {
                const mine = m.sender_id === user.id;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3 py-2 text-sm",
                      mine
                        ? "self-end bg-primary text-primary-foreground"
                        : "self-start bg-muted text-foreground"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.message}</p>
                    <span
                      className={cn(
                        "block mt-1 text-[10px]",
                        mine ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}
                    >
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <form
            onSubmit={send}
            className="flex items-center gap-2 border-t border-border/60 bg-background p-3"
          >
            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message"
              className="rounded-full"
            />
            <Button type="submit" size="icon" className="rounded-full" disabled={sending || !draft.trim()}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
