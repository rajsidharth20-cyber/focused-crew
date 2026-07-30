import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Unread message counts for the signed-in user, keyed by the other user's id. */
export function useUnreadMessages() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    if (!user) {
      setCounts({});
      return;
    }
    const { data } = await supabase
      .from("messages")
      .select("sender_id")
      .eq("receiver_id", user.id)
      .is("read_at", null);
    const next: Record<string, number> = {};
    (data ?? []).forEach((m: { sender_id: string }) => {
      next[m.sender_id] = (next[m.sender_id] ?? 0) + 1;
    });
    setCounts(next);
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return;
    const channel = supabase
      .channel(`unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, total, refresh };
}
