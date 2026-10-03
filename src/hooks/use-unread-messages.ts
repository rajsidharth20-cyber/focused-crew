import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { onUserEvent } from "@/lib/user-events";

/** Unread message counts for the signed-in user, keyed by the other user's id. */
export function useUnreadMessages() {
  const { user } = useAuth();
  const [unread, setUnread] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    if (!user) {
      setUnread({});
      return;
    }
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id")
      .eq("receiver_id", user.id)
      .is("read_at", null);
    const next: Record<string, string> = {};
    (data ?? []).forEach((m: { id: string; sender_id: string }) => {
      next[m.id] = m.sender_id;
    });
    setUnread(next);
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return;
    return onUserEvent(user.id, 'messages', payload => {
      const row = payload.new as { id?: string; sender_id?: string; receiver_id?: string; read_at?: string | null };
      const old = payload.old as { id?: string };
      const id = row?.id ?? old?.id;
      if (!id) return;
      setUnread(prev => {
        const next = { ...prev };
        if (payload.eventType === 'DELETE' || row.read_at || row.receiver_id !== user.id) delete next[id];
        else if (row.sender_id) next[id] = row.sender_id;
        return next;
      });
    });
  }, [user?.id, refresh]);

  const counts = useMemo(() => Object.values(unread).reduce<Record<string, number>>((result, sender) => {
    result[sender] = (result[sender] ?? 0) + 1;
    return result;
  }, {}), [unread]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, total, refresh };
}
