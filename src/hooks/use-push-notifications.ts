import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  pushSupported, registerPushToken, removePushToken, onForegroundMessage, getPushConfig,
} from '@/lib/push';
import { claimNotification } from '@/lib/notification-dedupe';
import { saveNotificationPreference } from '@/lib/notification-preferences';

export type NotificationPrefs = {
  push_enabled: boolean;
  direct_messages: boolean;
  group_messages: boolean;
  friend_requests: boolean;
  group_invites: boolean;
  study_reminders: boolean;
  streak_reminders: boolean;
  goal_completion: boolean;
  mentions: boolean;
  schedule_reminders: boolean;
  event_reminders: boolean;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  push_enabled: true,
  direct_messages: true,
  group_messages: true,
  friend_requests: true,
  group_invites: true,
  study_reminders: true,
  streak_reminders: true,
  goal_completion: true,
  mentions: true,
  schedule_reminders: true,
  event_reminders: true,
};

export function usePushNotifications() {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [permission, setPermission] = useState<NotificationPermission>(
    pushSupported() ? Notification.permission : 'denied',
  );
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const prefsReadyForUser = useRef<string | null>(null);

  const supported = pushSupported();

  useEffect(() => {
    if (!supported) { setConfigured(false); return; }
    getPushConfig().then((c) => setConfigured(!!c));
  }, [supported]);

  // Load preferences
  useEffect(() => {
    if (!user || isGuest) {
      prefsReadyForUser.current = null;
      setPrefs(DEFAULT_PREFS);
      setLoadingPrefs(false);
      return;
    }
    let cancelled = false;
    prefsReadyForUser.current = null;
    setPrefs(DEFAULT_PREFS);
    setLoadingPrefs(true);
    (async () => {
      const { data } = await supabase
        .from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle();
      if (cancelled) return;
      if (data) setPrefs({ ...DEFAULT_PREFS, ...data } as NotificationPrefs);
      prefsReadyForUser.current = user.id;
      setLoadingPrefs(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, isGuest]);

  // Refresh only after this account's saved preference has loaded and permits push.
  useEffect(() => {
    if (!user || isGuest || loadingPrefs || prefsReadyForUser.current !== user.id || !prefs.push_enabled || permission !== 'granted') return;
    registerPushToken(user.id).catch((e) => console.error('[push] token refresh failed', e));
  }, [user?.id, isGuest, permission, loadingPrefs, prefs.push_enabled]);

  // Foreground messages -> in-app toast that navigates on tap.
  useEffect(() => {
    if (!user || isGuest || permission !== 'granted') return;
    let unsub: (() => void) | undefined;
    let disposed = false;
    onForegroundMessage((payload) => {
      const d = payload?.data ?? {};
      if (disposed || document.visibilityState === 'hidden' || !d.title || !claimNotification(d.tag ?? '')) return;
      const path = typeof d.url === 'string' && /^\/(?!\/)/.test(d.url) ? d.url : '/';
      toast(d.title, {
        description: d.body,
        action: d.url ? { label: 'Open', onClick: () => navigate(path) } : undefined,
      });
    }).then((fn) => { if (disposed) fn(); else unsub = fn; });
    return () => { disposed = true; unsub?.(); };
  }, [user, isGuest, permission, navigate]);

  // Notification taps coming from the service worker.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.url) {
        const url = event.data.url;
        navigate(typeof url === 'string' && /^\/(?!\/)/.test(url) ? url : '/');
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [navigate]);

  const enable = useCallback(async () => {
    if (!supported) { toast.error('This browser does not support push notifications.'); return false; }
    if (!user || isGuest) { toast.error('Sign in to turn on notifications.'); return false; }
    if (window.top !== window.self) {
      toast.error('Open the app in its own tab to enable notifications.');
      return false;
    }
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        toast.error('Notifications are blocked. Enable them in your browser settings.');
        return false;
      }
      const token = await registerPushToken(user.id);
      if (!token) {
        toast.error('Could not set up notifications on this device.');
        return false;
      }
      const { error } = await supabase.from('notification_preferences')
        .upsert({ user_id: user.id, push_enabled: true }, { onConflict: 'user_id' });
      if (error) throw new Error('Could not save notification settings.');
      setPrefs((p) => ({ ...p, push_enabled: true }));
      localStorage.setItem('tp_push_asked', '1');
      toast.success('Notifications are on.');
      return true;
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Could not enable notifications.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, user?.id, isGuest]);

  const disable = useCallback(async () => {
    if (!user || isGuest) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('notification_preferences')
        .upsert({ user_id: user.id, push_enabled: false }, { onConflict: 'user_id' });
      if (error) throw new Error('Could not save notification settings.');
      setPrefs((p) => ({ ...p, push_enabled: false }));
      try {
        await removePushToken(user.id);
      } catch (e) {
        console.error('[push] device cleanup failed after notifications were disabled');
      }
      toast.success('Notifications turned off.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not turn off notifications.');
    } finally {
      setBusy(false);
    }
  }, [user?.id, isGuest]);

  const updatePref = useCallback(async (key: keyof NotificationPrefs, value: boolean) => {
    if (!user) return;
    const previousValue = prefs[key];
    setPrefs((current) => ({ ...current, [key]: value }));
    try {
      await saveNotificationPreference(supabase, user.id, key, value, DEFAULT_PREFS);
    } catch {
      setPrefs((current) => current[key] === value ? { ...current, [key]: previousValue } : current);
      toast.error('Could not save that setting.');
    }
  }, [user?.id, prefs]);

  return {
    supported, configured, permission, prefs, loadingPrefs, busy,
    enable, disable, updatePref,
    canPrompt: supported && permission === 'default' && !!user && !isGuest,
  };
}
