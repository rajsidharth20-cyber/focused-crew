import { Bell, X } from 'lucide-react';
import { useState } from 'react';
import { usePushNotifications } from '@/hooks/use-push-notifications';

/** One-time onboarding nudge asking for notification permission. */
export function PushPermissionPrompt() {
  const { canPrompt, configured, enable, busy } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('tp_push_asked') === '1');

  if (dismissed || !canPrompt || configured !== true) return null;

  const dismiss = () => { localStorage.setItem('tp_push_asked', '1'); setDismissed(true); };

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">Stay in the loop</div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Turn on notifications for messages, group invites and study reminders.
        </p>
        <button
          onClick={async () => { const ok = await enable(); if (ok) setDismissed(true); }}
          disabled={busy}
          className="mt-2 rounded-full bg-primary text-primary-foreground px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          Enable notifications
        </button>
      </div>
      <button onClick={dismiss} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
