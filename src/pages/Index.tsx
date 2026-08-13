import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plane, Swords, Flame, Timer, ChevronRight, Pause, Play } from 'lucide-react';
import { SubjectTimerList, fmtHMS } from '@/components/study/SubjectTimerList';
import { FullScreenSubjectTimer } from '@/components/study/FullScreenSubjectTimer';
import { useSubjectTimer } from '@/hooks/use-subject-timer';
import { getEffectiveToday } from '@/lib/day-boundary';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SettingsDialog } from '@/components/SettingsDialog';
import { ProfileDialog } from '@/components/ProfileDialog';
import { useTheme } from '@/hooks/use-theme';
import { DailyObjectives } from '@/components/DailyObjectives';
import { PushPermissionPrompt } from '@/components/PushPermissionPrompt';
import { useNotificationTriggers } from '@/hooks/use-notification-triggers';
import { UsernamePrompt } from '@/components/UsernamePrompt';
import { StreakCard } from '@/components/StreakCard';
import { JustTellMeMode, JustTellMeToggle } from '@/components/JustTellMeMode';
import { BottomNav, QUICK_ADD_EVENT } from '@/components/shell/BottomNav';
import { usePlannerStore } from '@/hooks/use-planner-store';
import { useStudyStore } from '@/hooks/use-study-store';
import { useStreak } from '@/hooks/use-streak';
import { useAuth } from '@/hooks/useAuth';
import { useEventReminders } from '@/hooks/use-event-reminders';
import { useNow } from '@/hooks/use-now';



const Index = () => {
  const store = usePlannerStore();
  useNotificationTriggers();
  const studyStore = useStudyStore();
  const streak = useStreak(studyStore.sessions);
  const { username } = useAuth();
  const { theme } = useTheme();
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



export default Index;
