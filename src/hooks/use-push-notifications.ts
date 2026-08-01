import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  pushSupported, registerPushToken, removePushToken, onForegroundMessage, getPushConfig,
} from '@/lib/push';

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

  const supported = pushSupported();

  useEffect(() => {
    if (!supported) { setConfigured(false); return; }
    getPushConfig().then((c) => setConfigured(!!c));
  }, [supported]);

  // Load preferences
  useEffect(() => {
    if (!user || isGuest) { setLoadingPrefs(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle();
      if (cancelled) return;
      if (data) setPrefs({ ...DEFAULT_PREFS, ...data } as NotificationPrefs);
      setLoadingPrefs(false);
    })();
    return () => { cancelled = true; };
  }, [user, isGuest]);

  // Keep the device token fresh whenever permission is already granted.
  useEffect(() => {
    if (!user || isGuest || permission !== 'granted') return;
    registerPushToken(user.id).catch((e) => console.error('[push] token refresh failed', e));
  }, [user, isGuest, permission]);

  // Foreground messages -> in-app toast that navigates on tap.
  useEffect(() => {
    if (!user || isGuest || permission !== 'granted') return;
    let unsub: any;
    onForegroundMessage((payload) => {
      const d = payload?.data ?? {};
      if (!d.title) return;
      toast(d.title, {
        description: d.body,
        action: d.url ? { label: 'Open', onClick: () => navigate(d.url) } : undefined,
      });
    }).then((fn) => { unsub = fn; });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [user, isGuest, permission, navigate]);

  // Notification taps coming from the service worker.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.url) {
        navigate(event.data.url);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [navigate]);

  const enable = useCallback(async () => {
    if (!supported) { toast.error('This browser does not support push notifications.'); return false; }
    if (!user || isGuest) { toast.error('Sign in to turn on notifications.'); return false; }
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
      await supabase.from('notification_preferences')
        .upsert({ user_id: user.id, ...prefs, push_enabled: true }, { onConflict: 'user_id' });
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
  }, [supported, user, isGuest, prefs]);

  const disable = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      await removePushToken();
      await supabase.from('notification_preferences')
        .upsert({ user_id: user.id, ...prefs, push_enabled: false }, { onConflict: 'user_id' });
      setPrefs((p) => ({ ...p, push_enabled: false }));
      toast.success('Notifications turned off.');
    } finally {
      setBusy(false);
    }
  }, [user, prefs]);

  const updatePref = useCallback(async (key: keyof NotificationPrefs, value: boolean) => {
    if (!user) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const { error } = await supabase.from('notification_preferences')
      .upsert({ user_id: user.id, ...next }, { onConflict: 'user_id' });
    if (error) {
      setPrefs(prefs);
      toast.error('Could not save that setting.');
    }
  }, [user, prefs]);

  return {
    supported, configured, permission, prefs, loadingPrefs, busy,
    enable, disable, updatePref,
    canPrompt: supported && permission === 'default' && !!user && !isGuest,
  };
}
