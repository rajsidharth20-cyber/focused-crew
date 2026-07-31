import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const db = supabase as any;

/**
 * Telegram-style "delete for me": the message stays for the other person,
 * but is hidden from this user's view on every device.
 */
export function useHiddenMessages(scope: 'dm' | 'group') {
  const { user } = useAuth();
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await db
      .from('hidden_messages')
      .select('message_id')
      .eq('user_id', user.id)
      .eq('scope', scope);
    setHidden(new Set(((data ?? []) as { message_id: string }[]).map(r => r.message_id)));
  }, [user, scope]);

  useEffect(() => {
    load();
  }, [load]);

  const hide = useCallback(
    async (messageId: string) => {
      if (!user) return;
      setHidden(prev => new Set(prev).add(messageId));
      await db
        .from('hidden_messages')
        .upsert({ user_id: user.id, message_id: messageId, scope }, { onConflict: 'user_id,message_id,scope' });
    },
    [user, scope]
  );

  return { hidden, hide, isHidden: (id: string) => hidden.has(id) };
}
