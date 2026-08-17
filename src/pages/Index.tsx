import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plane, Swords, Timer, ChevronRight, Pause, Play, Sparkles } from 'lucide-react';
import { fmtHMS } from '@/components/home/SubjectBoard';
import { TodayProgressCard } from '@/components/home/TodayProgressCard';
import { TodayObjectiveList } from '@/components/home/TodayObjectiveList';
import { StartStudyingSheet } from '@/components/home/StartStudyingSheet';
import { FullScreenSubjectTimer } from '@/components/study/FullScreenSubjectTimer';
import { useSubjectTimer } from '@/hooks/use-subject-timer';
import { useDayStart } from '@/hooks/use-day-start';
import { dayKeyFor, getEffectiveToday } from '@/lib/day-boundary';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SettingsDialog } from '@/components/SettingsDialog';
import { ProfileDialog } from '@/components/ProfileDialog';
import { useTheme } from '@/hooks/use-theme';

import { PushPermissionPrompt } from '@/components/PushPermissionPrompt';
import { useNotificationTriggers } from '@/hooks/use-notification-triggers';
import { UsernamePrompt } from '@/components/UsernamePrompt';
import { StreakCard } from '@/components/StreakCard';
import { JustTellMeMode, JustTellMeToggle } from '@/components/JustTellMeMode';
import { BottomNav, QUICK_ADD_EVENT } from '@/components/shell/BottomNav';
import { DeveloperNoticeCard } from '@/components/announcements/DeveloperNoticeCard';
import { usePlannerStore } from '@/hooks/use-planner-store';
import { useStudyStore } from '@/hooks/use-study-store';
import { useStreak } from '@/hooks/use-streak';
import { useAuth } from '@/hooks/useAuth';
import { useEventReminders } from '@/hooks/use-event-reminders';
import { useNow } from '@/hooks/use-now';

const greeting = (d: Date) => {
  const h = d.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const Index = () => {
  const store = usePlannerStore();
  useNotificationTriggers();
  const studyStore = useStudyStore();
  const streak = useStreak(studyStore.sessions);
  const { username } = useAuth();
  const { theme } = useTheme();
  useDayStart();
  useEventReminders(store.events, store.commitments);
  const now = useNow(30_000);
  const [focusMode, setFocusMode] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
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

  // ---- subject timers ----
  const subjectName = (id: string | null) => store.subjects.find(s => s.id === id)?.name ?? null;
  const timer = useSubjectTimer(subjectName);
  const [timerOpen, setTimerOpen] = useState(false);

  const todayTotals = useMemo(() => {
    const day = getEffectiveToday();
    const map: Record<string, number> = {};
    for (const s of studyStore.sessions) {
      if (!s.subjectId) continue;
      if (dayKeyFor(new Date(s.startedAt)) !== day) continue;
      map[s.subjectId] = (map[s.subjectId] ?? 0) + s.durationSeconds;
    }
    return map;
  }, [studyStore.sessions]);

  const activeSubject = store.subjects.find(s => s.id === timer.activeSubjectId) ?? null;

  const handlePlay = async (subjectId: string) => {
    if (timer.timer && timer.activeSubjectId !== subjectId) {
      const finished = await timer.stop();
      if (finished) {
        await studyStore.addSession({
          subjectId: finished.subjectId, type: 'stopwatch',
          durationSeconds: finished.durationSeconds,
          startedAt: finished.startedAt, endedAt: finished.endedAt,
        });
      }
    }
    await timer.start(subjectId);
    setStartOpen(false);
    setTimerOpen(true);
  };

  const handleStop = async () => {
    const finished = await timer.stop();
    setTimerOpen(false);
    if (finished) {
      await studyStore.addSession({
        subjectId: finished.subjectId, type: 'stopwatch',
        durationSeconds: finished.durationSeconds,
        startedAt: finished.startedAt, endedAt: finished.endedAt,
      });
      toast.success(`Session saved · ${Math.round(finished.durationSeconds / 60)}m`);
    }
  };

  const minutesToday = streak.todayMinutes + (timer.isRunning ? Math.floor(timer.elapsed / 60) : 0);
  const subjectsActive = Object.keys(todayTotals).length;

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

      {/* Greeting header */}
      <header className="sticky top-0 z-30 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-primary shadow-md">
              <ThemeIcon className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-[15.5px] font-bold leading-tight tracking-tight">
                {greeting(now)}{username ? `, ${username}` : ''} 👋
              </h1>
              <p className="mt-0.5 truncate text-[10.5px] leading-none text-muted-foreground">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <JustTellMeToggle active={focusMode} onClick={() => setFocusMode(v => !v)} />
            <ProfileDialog />
            <SettingsDialog />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-4">
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
              className="space-y-6"
            >
              <TodayProgressCard
                minutesToday={minutesToday}
                goalMinutes={streak.thresholdMinutes}
                streak={streak.streak}
                subjectsActive={subjectsActive}
                onOpenStreak={() => setStreakOpen(true)}
              />

              <DeveloperNoticeCard />

              {/* Primary action */}
              <button
                onClick={() => (activeSubject ? setTimerOpen(true) : setStartOpen(true))}
                className="press relative flex w-full items-center gap-3 overflow-hidden rounded-[24px] bg-gradient-primary px-5 py-4 text-left text-primary-foreground shadow-lg"
              >
                <Sparkles className="h-5 w-5 shrink-0 opacity-90" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-tight">
                    {activeSubject ? `Back to ${activeSubject.name}` : 'Start studying'}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] opacity-85">
                    {activeSubject ? 'Your session is still open' : 'Pick a subject and the clock starts'}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-90" />
              </button>

              {/* Today's objectives (read-only — edit in the Planner) */}
              <div ref={dailyRef} className="scroll-mt-20">
                <TodayObjectiveList
                  subjects={store.subjects}
                  objectives={store.dailyObjectives}
                  onToggle={store.toggleDailyObjective}
                />
              </div>

              <Link
                to="/study"
                className="flex items-center gap-2 px-1 pb-2 text-[12px] text-muted-foreground"
              >
                <Timer className="h-3.5 w-3.5" />
                Pomodoro & session history
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <StartStudyingSheet
        open={startOpen}
        onOpenChange={setStartOpen}
        subjects={store.subjects}
        onStart={handlePlay}
        onCreate={store.addSubject}
      />

      <Dialog open={streakOpen} onOpenChange={setStreakOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Study streak</DialogTitle>
          </DialogHeader>
          <StreakCard sessions={studyStore.sessions} />
        </DialogContent>
      </Dialog>

      {/* Compact floating session pill */}
      <AnimatePresence>
        {activeSubject && !timerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="pointer-events-none fixed bottom-24 left-0 right-0 z-40 flex justify-center px-4"
          >
            <div
              role="button"
              onClick={() => setTimerOpen(true)}
              className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-border/50 bg-background/85 py-1.5 pl-3 pr-1.5 shadow-xl backdrop-blur-xl"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: activeSubject.color || 'hsl(var(--primary))' }}
              />
              <span className="max-w-[7.5rem] truncate text-[12.5px] font-medium">{activeSubject.name}</span>
              <span className="text-[12.5px] font-semibold tabular-nums">{fmtHMS(timer.elapsed)}</span>
              <button
                onClick={e => { e.stopPropagation(); timer.isRunning ? timer.pause() : timer.resume(); }}
                aria-label={timer.isRunning ? 'Pause timer' : 'Resume timer'}
                className="press grid h-7 w-7 place-items-center rounded-full bg-foreground/10"
              >
                {timer.isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {timerOpen && activeSubject && (
          <FullScreenSubjectTimer
            subjectName={activeSubject.name}
            color={activeSubject.color || 'hsl(var(--primary))'}
            elapsed={timer.elapsed}
            isRunning={timer.isRunning}
            onPause={timer.pause}
            onResume={timer.resume}
            onStop={handleStop}
            onClose={() => setTimerOpen(false)}
          />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
};

export default Index;
