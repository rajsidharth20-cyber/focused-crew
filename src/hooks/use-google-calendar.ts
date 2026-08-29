import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type CalendarState = 'disconnected' | 'connected' | 'reconnect_required';

interface Status {
  state: CalendarState;
  connected: boolean;
  email: string | null;
  lastSyncedAt: string | null;
}

const FRIENDLY_FALLBACK = 'Something went wrong with Google Calendar. Please try again.';

/**
 * Invokes the edge function and surfaces only a human-readable message —
 * never raw gateway JSON. Connection keys never reach the browser.
 */
async function callFn(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('google-calendar', { body });
  if (error) {
    let message = FRIENDLY_FALLBACK;
    try {
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx) {
        const text = await ctx.text();
        const parsed = JSON.parse(text) as { error?: string; code?: string };
        if (parsed?.error) {
          const e = new Error(parsed.error) as Error & { code?: string };
          e.code = parsed.code;
          throw e;
        }
      }
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message !== FRIENDLY_FALLBACK && (parseErr as Error).name !== 'SyntaxError') {
        throw parseErr;
      }
    }
    throw new Error(message);
  }
  if (data?.error) {
    const e = new Error(data.error) as Error & { code?: string };
    e.code = data.code;
    throw e;
  }
  return data;
}

export function useGoogleCalendar() {
  const { user, isGuest } = useAuth();
  const [status, setStatus] = useState<Status>({ state: 'disconnected', connected: false, email: null, lastSyncedAt: null });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || isGuest) { setLoading(false); return; }
    try {
      const data = await callFn({ action: 'status' });
      setStatus({
        state: (data.state as CalendarState) ?? (data.connected ? 'connected' : 'disconnected'),
        connected: !!data.connected,
        email: data.email ?? null,
        lastSyncedAt: data.lastSyncedAt ?? null,
      });
    } catch {
      /* silent — treated as not connected */
    } finally {
      setLoading(false);
    }
  }, [user, isGuest]);

  useEffect(() => { refresh(); }, [refresh]);

  const sync = useCallback(async (silent = false) => {
    setSyncing(true);
    setError(null);
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
      const e = err as Error & { code?: string };
      if (e.code === 'reconnect_required') {
        setStatus(s => ({ ...s, state: 'reconnect_required', connected: false }));
      }
      setError(e.message);
      if (!silent) toast.error(e.message || 'Sync failed.');
      return undefined;
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  const connect = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setConnecting(true);
    setError(null);
    // Open the popup synchronously so browsers don't block it.
    const popup = window.open('', 'google-calendar-connect', 'width=520,height=680');
    popupRef.current = popup;
    try {
      const data = await callFn({ action: 'start', returnUrl: `${window.location.origin}/google-callback` });
      if (!data?.authorization_url) throw new Error('We couldn\u2019t open the Google sign-in window. Please try again.');
      if (popup) popup.location.href = data.authorization_url;
      else window.location.href = data.authorization_url;
    } catch (err) {
      const e = err as Error & { code?: string };
      popup?.close();
      inFlight.current = false;
      setConnecting(false);
      if (e.code === 'reconnect_key_missing') {
        setStatus(s => ({ ...s, state: 'disconnected', connected: false }));
      }
      setError(e.message);
      toast.error(e.message || 'Could not connect to Google.');
    }
  }, []);

  useEffect(() => {
    const onMessage = async (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      if (ev.data?.source !== 'taskpilot-google-calendar') return;
      popupRef.current?.close();
      if (ev.data.error || !ev.data.code) {
        inFlight.current = false;
        setConnecting(false);
        setError(ev.data.error || 'Google connection was cancelled.');
        toast.error(ev.data.error || 'Google connection was cancelled.');
        return;
      }
      try {
        await callFn({ action: 'exchange', code: ev.data.code });
        setError(null);
        toast.success('Google Calendar connected.');
        await refresh();
        await sync(true);
        toast.success('Your schedule was pushed to Google Calendar.');
      } catch (err) {
        const msg = (err as Error).message || 'Could not finish connecting.';
        setError(msg);
        toast.error(msg);
      } finally {
        inFlight.current = false;
        setConnecting(false);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refresh, sync]);

  const disconnect = useCallback(async () => {
    try {
      await callFn({ action: 'disconnect' });
      setError(null);
      toast.success('Google Calendar disconnected.');
      await refresh();
    } catch (err) {
      const msg = (err as Error).message || 'Could not disconnect.';
      setError(msg);
      toast.error(msg);
    }
  }, [refresh]);

  return { status, loading, connecting, syncing, error, connect, disconnect, sync, refresh };
}
