import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, Loader2, MessageSquare, Users, UserPlus, Mail, Timer, Flame, Target, AtSign, CalendarClock, CalendarDays, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { usePushNotifications, type NotificationPrefs } from '@/hooks/use-push-notifications';

type Item = { key: keyof NotificationPrefs; label: string; desc: string; Icon: any };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Chats',
    items: [
      { key: 'direct_messages', label: 'Direct messages', desc: 'When someone messages you privately', Icon: MessageSquare },
      { key: 'group_messages', label: 'Group chat', desc: "Only when you're not already in that chat", Icon: Users },
      { key: 'mentions', label: 'Mentions & replies', desc: 'When someone mentions or replies to you', Icon: AtSign },
    ],
  },
  {
    title: 'People & groups',
    items: [
      { key: 'friend_requests', label: 'Friend requests', desc: 'New requests and acceptances', Icon: UserPlus },
      { key: 'group_invites', label: 'Group invitations', desc: 'When you are invited to a study group', Icon: Mail },
    ],
  },
  {
    title: 'Schedule',
    items: [
      { key: 'schedule_reminders', label: 'Schedule & classes', desc: 'Before a class or commitment starts', Icon: CalendarClock },
      { key: 'event_reminders', label: 'Events', desc: 'Reminders 30 and 15 minutes before an event', Icon: CalendarDays },
    ],
  },
  {
    title: 'Progress',
    items: [
      { key: 'study_reminders', label: 'Study reminders', desc: 'Nudges to start your planned sessions', Icon: Timer },
      { key: 'streak_reminders', label: 'Streak reminders', desc: 'Before your streak is at risk', Icon: Flame },
      { key: 'goal_completion', label: 'Goal completion', desc: 'When you finish objectives or weekly targets', Icon: Target },
    ],
  },
];

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { supported, configured, permission, prefs, loadingPrefs, busy, enable, disable, updatePref } = usePushNotifications();

  const on = permission === 'granted' && prefs.push_enabled;

  return (
    <div className="min-h-screen bg-background">
      <header
        className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50 px-2 py-2 flex items-center gap-1"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <button onClick={() => navigate(-1)} className="p-2.5 rounded-full active:scale-95 hover:bg-muted transition" aria-label="Go back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[17px] font-display font-semibold">Notifications</h1>
      </header>

      <main className="px-4 py-4 space-y-6 max-w-lg mx-auto pb-28">
        {/* Master switch — app-style hero card */}
        <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex flex-col items-center text-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${on ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {on ? <Bell className="w-7 h-7" /> : <BellOff className="w-7 h-7" />}
            </div>
            <div>
              <div className="font-semibold text-base">Push notifications</div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {!supported
                  ? 'This browser does not support push notifications. Install the app on Android/Chrome for the best experience.'
                  : configured === false
                    ? 'Push is not configured yet for this app.'
                    : permission === 'denied'
                      ? 'Blocked in your browser settings — allow notifications for this site to turn them back on.'
                      : on
                        ? 'Enabled on this device.'
                        : 'Get alerted about messages, classes, events and reminders even when the app is closed.'}
              </p>
            </div>
            <button
              onClick={() => (on ? disable() : enable())}
              disabled={busy || !supported || permission === 'denied' || configured === false}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
                on ? 'border border-border bg-secondary text-foreground' : 'bg-primary text-primary-foreground'
              }`}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {on ? 'Turn off' : 'Enable notifications'}
            </button>
          </div>
        </section>

        {GROUPS.map((group) => (
          <section key={group.title} className="space-y-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-3">{group.title}</h2>
            <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/50 overflow-hidden">
              {group.items.map(({ key, label, desc, Icon }) => (
                <div key={key} className="flex items-center gap-3 px-4 py-3.5 active:bg-muted/40 transition">
                  <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight">{label}</div>
                    <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{desc}</div>
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
        ))}

        <button
          onClick={() => navigate('/install')}
          className="w-full rounded-2xl border border-border/60 bg-card px-4 py-3.5 flex items-center gap-3 text-left active:bg-muted/40 transition"
        >
          <div className="flex-1">
            <div className="text-sm font-medium">Install the app</div>
            <div className="text-[11px] text-muted-foreground">Notifications are most reliable from the installed app.</div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </main>
    </div>
  );
}
