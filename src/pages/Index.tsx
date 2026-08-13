import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, Swords, Flame, Sparkles, CheckCircle2, Timer, Target, ChevronRight, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SettingsDialog } from '@/components/SettingsDialog';
import { ProfileDialog } from '@/components/ProfileDialog';
import { useTheme } from '@/hooks/use-theme';
import { useTerms } from '@/lib/terms';
import { DailyObjectives } from '@/components/DailyObjectives';
import { PushPermissionPrompt } from '@/components/PushPermissionPrompt';
import { useNotificationTriggers } from '@/hooks/use-notification-triggers';
import { AIAdvisor } from '@/components/AIAdvisor';
import { UsernamePrompt } from '@/components/UsernamePrompt';
import { ProgressRing } from '@/components/ProgressRing';
import { StreakCard } from '@/components/StreakCard';
import { JustTellMeMode, JustTellMeToggle } from '@/components/JustTellMeMode';
import { BottomNav, QUICK_ADD_EVENT } from '@/components/shell/BottomNav';
import { EmptyState } from '@/components/EmptyState';
import { usePlannerStore } from '@/hooks/use-planner-store';
import { useStudyStore } from '@/hooks/use-study-store';
import { useStreak } from '@/hooks/use-streak';
import { useAuth } from '@/hooks/useAuth';
import { useEventReminders } from '@/hooks/use-event-reminders';
import { useNow } from '@/hooks/use-now';

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, med: 1, low: 2 };

const Index = () => {
  const store = usePlannerStore();
  useNotificationTriggers();
  const studyStore = useStudyStore();
  const streak = useStreak(studyStore.sessions);
  const { username } = useAuth();
  const { theme } = useTheme();
  const t = useTerms();
  useEventReminders(store.events, store.commitments);
  const now = useNow(30_000);
  const clock = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const [focusMode, setFocusMode] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const dailyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => {
      setFocusMode(false);
      requestAnimationFrame(() =>
        dailyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      );
    };
    window.addEventListener(QUICK_ADD_EVENT, handler);
    return () => window.removeEventListener(QUICK_ADD_EVENT, handler);
  }, []);

  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const ThemeIcon = theme === 'war' ? Swords : Plane;

  const totalDaily = store.dailyObjectives.length;
  const doneDaily = store.dailyObjectives.filter(o => o.completed).length;
  const pctDaily = totalDaily > 0 ? (doneDaily / totalDaily) * 100 : 0;
  const highPriority = store.dailyObjectives.filter(o => !o.completed && o.priority === 'high').length;

  const topTask = useMemo(() => {
    const open = store.dailyObjectives.filter(o => !o.completed);
    if (open.length === 0) return null;
    return [...open].sort((a, b) => {
      const pr = (PRIORITY_RANK[String(a.priority)] ?? 1) - (PRIORITY_RANK[String(b.priority)] ?? 1);
      if (pr !== 0) return pr;
      if (a.deadline && b.deadline) return a.deadline < b.deadline ? -1 : 1;
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    })[0];
  }, [store.dailyObjectives]);

  const subjectName = topTask?.subjectId
    ? store.subjects.find(s => s.id === topTask.subjectId)?.name
    : undefined;

  const todaySessionMin = streak.todayMinutes;

  return (
    <div
      className="relative min-h-screen overflow-x-hidden app-surface"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="aurora animate-float" style={{ width: 360, height: 360, background: 'hsl(var(--primary) / 0.28)', top: -120, left: -100 }} />
        <div className="aurora animate-float" style={{ width: 400, height: 400, background: 'hsl(var(--accent) / 0.22)', top: 240, right: -140, animationDelay: '1.5s' }} />
      </div>

      {username === null && <UsernamePrompt />}

      {/* Minimal app bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-2xl bg-gradient-primary grid place-items-center shadow-md shrink-0">
              <ThemeIcon className="w-4 h-4 text-primary-foreground" />
            </div>
            <button
              onClick={() => setStreakOpen(true)}
              aria-label="Study streak details"
              className="press inline-flex items-center gap-1 px-2 h-7 rounded-full border border-border/60 bg-background/60 text-[12px] font-bold tabular-nums"
            >
              <Flame className={`w-3.5 h-3.5 ${streak.streak > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              {streak.streak}
            </button>
            <div className="min-w-0">
              <p className="text-[10.5px] text-muted-foreground leading-none">{today}</p>
              <h1 className="font-display text-[14px] font-bold tracking-tight truncate leading-tight mt-0.5">
                {clock}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <JustTellMeToggle active={focusMode} onClick={() => setFocusMode(v => !v)} />
            <ProfileDialog />
            <SettingsDialog />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-3 space-y-4">
        <PushPermissionPrompt />

        <AnimatePresence mode="wait">
          {focusMode ? (
            <motion.div
              key="focus"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <JustTellMeMode
                subjects={store.subjects}
                objectives={store.dailyObjectives}
                onToggle={store.toggleDailyObjective}
                active={focusMode}
                onExit={() => setFocusMode(false)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Study timer */}
              <Link
                to="/study"
                className="glass-card press flex items-center gap-3 px-4 py-3.5"
              >
                <span className="w-9 h-9 rounded-2xl bg-gradient-primary grid place-items-center shrink-0">
                  <Timer className="w-4 h-4 text-primary-foreground" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold leading-tight">Study timer</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    Pomodoro & stopwatch · {todaySessionMin}m today
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>

              {/* Today's tasks */}
              <div ref={dailyRef} className="scroll-mt-20">
                <DailyObjectives
                  subjects={store.subjects}
                  objectives={store.dailyObjectives}
                  pastObjectives={store.pastObjectives}
                  onAdd={store.addDailyObjective}
                  onToggle={store.toggleDailyObjective}
                  onAddNote={store.addProgressNote}
                  onUpdateNotes={store.updateProgressNotes}
                  onUpdatePriority={store.updateObjectivePriority}
                  onRemove={store.removeDailyObjective}
                  onCarryForward={store.carryForwardObjective}
                  templates={store.objectiveTemplates}
                  onRemoveTemplate={store.removeObjectiveTemplate}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Dialog open={streakOpen} onOpenChange={setStreakOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Study streak</DialogTitle>
          </DialogHeader>
          <StreakCard sessions={studyStore.sessions} />
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};


function MiniMetric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="glass-card px-3 py-3 flex flex-col gap-1.5">
      <Icon className="w-4 h-4 text-primary" />
      <div>
        <div className="text-[15px] font-bold tabular-nums leading-none">{value}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
}

export default Index;
