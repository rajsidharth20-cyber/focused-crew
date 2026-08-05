import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Status {
  connected: boolean;
  email: string | null;
  lastSyncedAt: string | null;
}

async function callFn(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('google-calendar', { body });
  if (error) {
    let details = error.message;
    try {
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx) details = await ctx.text();
    } catch { /* ignore */ }
    throw new Error(details);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useGoogleCalendar() {
  const { user, isGuest } = useAuth();
  const [status, setStatus] = useState<Status>({ connected: false, email: null, lastSyncedAt: null });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const refresh = useCallback(async () => {
    if (!user || isGuest) { setLoading(false); return; }
    try {
      const data = await callFn({ action: 'status' });
      setStatus({ connected: !!data.connected, email: data.email ?? null, lastSyncedAt: data.lastSyncedAt ?? null });
    } catch {
      /* silent — treated as not connected */
    } finally {
      setLoading(false);
    }
  }, [user, isGuest]);

  useEffect(() => { refresh(); }, [refresh]);

  const sync = useCallback(async (silent = false) => {
    setSyncing(true);
    try {
      const res = await callFn({
        action: 'sync',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        today: new Date().toLocaleDateString('en-CA'),
      });
      if (!silent) {
        toast.success(`Synced to Google Calendar — ${res.created} added, ${res.updated} updated${res.removed ? `, ${res.removed} removed` : ''}.`);
      }
      await refresh();
      return res;
    } catch (err) {
      toast.error((err as Error).message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  const connect = useCallback(async () => {
    setConnecting(true);
    // Open the popup synchronously so browsers don't block it.
    const popup = window.open('', 'google-calendar-connect', 'width=520,height=680');
    popupRef.current = popup;
    try {
      const data = await callFn({ action: 'start', returnUrl: `${window.location.origin}/google-callback` });
      if (!data?.authorization_url) throw new Error('Could not start Google authorization.');
      if (popup) popup.location.href = data.authorization_url;
      else window.location.href = data.authorization_url;
    } catch (err) {
      popup?.close();
      setConnecting(false);
      toast.error((err as Error).message || 'Could not connect to Google.');
    }
  }, []);

  useEffect(() => {
    const onMessage = async (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      if (ev.data?.source !== 'taskpilot-google-calendar') return;
      popupRef.current?.close();
      if (ev.data.error || !ev.data.code) {
        setConnecting(false);
        toast.error(ev.data.error || 'Google connection was cancelled.');
        return;
      }
      try {
        await callFn({ action: 'exchange', code: ev.data.code });
        toast.success('Google Calendar connected.');
        await refresh();
        await sync(true);
        toast.success('Your schedule was pushed to Google Calendar.');
      } catch (err) {
        toast.error((err as Error).message || 'Could not finish connecting.');
      } finally {
        setConnecting(false);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refresh, sync]);

  const disconnect = useCallback(async () => {
    try {
      await callFn({ action: 'disconnect' });
      toast.success('Google Calendar disconnected.');
      await refresh();
    } catch (err) {
      toast.error((err as Error).message || 'Could not disconnect.');
    }
  }, [refresh]);

  return { status, loading, connecting, syncing, connect, disconnect, sync, refresh };
}
