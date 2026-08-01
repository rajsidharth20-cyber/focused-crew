import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, Loader2, MessageSquare, Users, UserPlus, Mail, Timer, Flame, Target, AtSign } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePushNotifications, type NotificationPrefs } from '@/hooks/use-push-notifications';

const CATEGORIES: { key: keyof NotificationPrefs; label: string; desc: string; Icon: any }[] = [
  { key: 'direct_messages', label: 'Direct messages', desc: 'When someone messages you privately', Icon: MessageSquare },
  { key: 'group_messages', label: 'Group messages', desc: "Only when you're not already in that chat", Icon: Users },
  { key: 'friend_requests', label: 'Friend requests', desc: 'New requests and acceptances', Icon: UserPlus },
  { key: 'group_invites', label: 'Group invitations', desc: 'When you are invited to a study group', Icon: Mail },
  { key: 'study_reminders', label: 'Study reminders', desc: 'Nudges to start your planned sessions', Icon: Timer },
  { key: 'streak_reminders', label: 'Streak reminders', desc: "Before your streak is at risk", Icon: Flame },
  { key: 'goal_completion', label: 'Goal completion', desc: 'When you finish objectives or weekly targets', Icon: Target },
  { key: 'mentions', label: 'Mentions & replies', desc: 'When someone mentions or replies to you', Icon: AtSign },
];

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { supported, configured, permission, prefs, loadingPrefs, busy, enable, disable, updatePref } = usePushNotifications();

  const on = permission === 'granted' && prefs.push_enabled;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border/50 px-4 py-3 flex items-center gap-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-muted" aria-label="Go back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-display font-semibold">Notifications</h1>
      </header>

      <main className="p-4 space-y-6 max-w-lg mx-auto pb-24">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${on ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {on ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">Push notifications</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {!supported
                  ? 'This browser does not support push notifications. Install the app on Android/Chrome for the best experience.'
                  : configured === false
                    ? 'Push is not configured yet for this app.'
                    : permission === 'denied'
                      ? 'Blocked in your browser settings — allow notifications for this site to turn them back on.'
                      : on
                        ? 'Enabled on this device.'
                        : 'Get alerted about messages, invites and reminders even when the app is closed.'}
              </p>
              <button
                onClick={() => (on ? disable() : enable())}
                disabled={busy || !supported || permission === 'denied' || configured === false}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {on ? 'Turn off' : 'Enable notifications'}
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <Label className="text-sm text-muted-foreground px-1">What you get notified about</Label>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border/60">
            {CATEGORIES.map(({ key, label, desc, Icon }) => (
              <div key={key} className="flex items-center gap-3 p-4">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
                <Switch
                  checked={!!prefs[key]}
                  disabled={loadingPrefs || !on}
                  onCheckedChange={(v) => updatePref(key, v)}
                  aria-label={label}
                />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
