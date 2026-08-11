import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';

export type NotificationCategory =
  | 'direct_messages'
  | 'group_messages'
  | 'friend_requests'
  | 'group_invites'
  | 'study_reminders'
  | 'streak_reminders'
  | 'goal_completion'
  | 'mentions'
  | 'schedule_reminders'
  | 'event_reminders';

type PushConfig = {
  apiKey: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

let configPromise: Promise<PushConfig | null> | null = null;

export async function getPushConfig(): Promise<PushConfig | null> {
  configPromise ??= (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('push-config');
      if (error) throw error;
      if (!data?.apiKey || !data?.vapidKey) return null;
      return data as PushConfig;
    } catch (e) {
      console.error('[push] config unavailable', e);
      return null;
    }
  })();
  return configPromise;
}

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
}

let messagingPromise: Promise<Messaging | null> | null = null;

async function getMessagingInstance(cfg: PushConfig): Promise<Messaging | null> {
  messagingPromise ??= (async () => {
    if (!(await isSupported())) return null;
    const app: FirebaseApp = getApps()[0] ?? initializeApp({
      apiKey: cfg.apiKey,
      projectId: cfg.projectId,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
    });
    return getMessaging(app);
  })();
  return messagingPromise;
}

/** Registers the FCM service worker and stores the device token for the signed-in user. */
export async function registerPushToken(userId: string): Promise<string | null> {
  if (!pushSupported() || Notification.permission !== 'granted') return null;
  const cfg = await getPushConfig();
  if (!cfg) return null;

  const messaging = await getMessagingInstance(cfg);
  if (!messaging) return null;

  // Keep the FCM worker off the root scope — sharing '/' with the PWA worker
  // makes both fight for control of the page and triggers reload loops.
  const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/firebase-cloud-messaging-push-scope',
  });
  const token = await getToken(messaging, { vapidKey: cfg.vapidKey, serviceWorkerRegistration: swReg });
  if (!token) return null;

  await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      token,
      user_agent: navigator.userAgent.slice(0, 300),
      device_label: /Android/i.test(navigator.userAgent) ? 'Android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iOS' : 'Desktop',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );

  localStorage.setItem('tp_push_token', token);
  return token;
}

export async function removePushToken() {
  const token = localStorage.getItem('tp_push_token');
  if (!token) return;
  await supabase.from('push_tokens').delete().eq('token', token);
  localStorage.removeItem('tp_push_token');
}

export async function onForegroundMessage(handler: (payload: any) => void) {
  const cfg = await getPushConfig();
  if (!cfg) return () => {};
  const messaging = await getMessagingInstance(cfg);
  if (!messaging) return () => {};
  return onMessage(messaging, handler);
}

/** Fire-and-forget notification send. Never throws into the UI. */
export async function sendPush(args: {
  userIds: string[];
  category: NotificationCategory;
  title: string;
  body: string;
  url: string;
  dedupeKey: string;
}) {
  const targets = args.userIds.filter(Boolean);
  if (targets.length === 0) return;
  try {
    await supabase.functions.invoke('send-push', { body: { ...args, userIds: targets } });
  } catch (e) {
    console.error('[push] send failed', e);
  }
}
