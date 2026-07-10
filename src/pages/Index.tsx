import { motion } from 'framer-motion';
import { Plane, Trash2, LogOut, Swords, Sparkles, Flame, TrendingUp, CheckCircle2, FileDown, Loader2, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';
import { generateDailySummaryPDF } from '@/lib/daily-summary-pdf';
import { SettingsDialog } from '@/components/SettingsDialog';
import { ProfileDialog } from '@/components/ProfileDialog';
import { useTheme } from '@/hooks/use-theme';
import { SubjectManager } from '@/components/SubjectManager';
import { WeeklyTargets } from '@/components/WeeklyTargets';
import { DailyObjectives } from '@/components/DailyObjectives';
import { Commitments } from '@/components/Commitments';
import { UpcomingEvents } from '@/components/UpcomingEvents';
import { FlightProtocols } from '@/components/FlightProtocols';
import { AIAdvisor } from '@/components/AIAdvisor';
import { UsernamePrompt } from '@/components/UsernamePrompt';
import { ProgressRing } from '@/components/ProgressRing';
import { StreakCard } from '@/components/StreakCard';
import { JustTellMeMode, JustTellMeToggle } from '@/components/JustTellMeMode';
import { usePlannerStore } from '@/hooks/use-planner-store';
import { useStudyStore } from '@/hooks/use-study-store';
import { useAuth } from '@/hooks/useAuth';
import { useEventReminders } from '@/hooks/use-event-reminders';
import { QuoteCard } from '@/components/QuoteCard';

const getGreeting = (theme: string) => {
  const hour = new Date().getHours();
  if (theme === 'war') {
    if (hour < 12) return 'Morning briefing';
    if (hour < 17) return 'Afternoon ops';
    return 'Night watch';
  }
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

import type { Variants } from 'framer-motion';
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.05 + i * 0.06, duration: 0.5, ease: 'easeOut' },
  }),
};

const Index = () => {
  const store = usePlannerStore();
  const studyStore = useStudyStore();
  const { username, signOut } = useAuth();
  const { theme } = useTheme();
  useEventReminders(store.events);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const handleDownloadSummary = async () => {
    setDownloadingPdf(true);
    const t = toast.loading('Preparing your daily summary…');
    try {
      await generateDailySummaryPDF({
        username,
        subjects: store.subjects,
        dailyObjectives: store.dailyObjectives,
        weeklyTargets: store.weeklyTargets,
        commitments: store.commitments,
        events: store.events,
      });
      toast.success('Summary downloaded', { id: t });
    } catch (e) {
      console.error(e);
      toast.error('Could not generate PDF', { id: t });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const ThemeIcon = theme === 'war' ? Swords : Plane;

  // Live stats for hero
  const totalDaily = store.dailyObjectives.length;
  const doneDaily = store.dailyObjectives.filter(o => o.completed).length;
  const pctDaily = totalDaily > 0 ? (doneDaily / totalDaily) * 100 : 0;
  const totalWeekly = store.weeklyTargets.length;
  const doneWeekly = store.weeklyTargets.filter(t => t.completed).length;
  const upcomingCount = store.events.length;
  const highPriority = store.dailyObjectives.filter(o => !o.completed && o.priority === 'high').length;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Ambient auroras */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="aurora animate-float" style={{ width: 480, height: 480, background: 'hsl(var(--primary) / 0.35)', top: -140, left: -120 }} />
        <div className="aurora animate-float" style={{ width: 520, height: 520, background: 'hsl(var(--accent) / 0.3)', top: 120, right: -160, animationDelay: '1.5s' }} />
      </div>

      {username === null && <UsernamePrompt />}

      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/60 border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg shrink-0">
              <ThemeIcon className="w-5 h-5 text-primary-foreground" />
              <span className="absolute -inset-0.5 rounded-xl bg-gradient-primary opacity-40 blur-md -z-10" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-bold tracking-tight truncate">
                Task Pilot
              </h1>
              <p className="text-[11px] text-muted-foreground truncate">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <JustTellMeToggle active={focusMode} onClick={() => setFocusMode(v => !v)} />
            <Link
              to="/study"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-gradient-primary text-primary-foreground shadow-md hover:opacity-90 transition"
              aria-label="Open Study Timer"
            >
              <Timer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Study Timer</span>
            </Link>
            <ProfileDialog />
            <SettingsDialog />
            <button
              onClick={handleDownloadSummary}
              disabled={downloadingPdf}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors px-2.5 py-1.5 rounded-md hover:bg-primary/10 disabled:opacity-50"
              aria-label="Download daily summary as PDF"
            >
              {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Summary PDF</span>
            </button>
            <button
              onClick={store.clearDay}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors px-2.5 py-1.5 rounded-md hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {theme === 'war' ? 'Clear Field' : 'Clear Runway'}
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md hover:bg-secondary"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{theme === 'war' ? 'Retreat' : 'Disembark'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* QUOTE */}
        <QuoteCard />
        {/* HERO */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="glass-card glow-sky p-5 sm:p-8 overflow-hidden relative"
        >
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
            <div className="flex-1 min-w-0 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-display text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-3">
                <Sparkles className="w-3 h-3" />
                {theme === 'war' ? 'Ops Briefing' : 'Flight Deck'}
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight">
                {getGreeting(theme)}
                {username ? <>, <span className="text-gradient">{username}</span></> : ''}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-md mx-auto md:mx-0">
                {totalDaily === 0
                  ? 'A clear runway. Add your first objective and take off.'
                  : doneDaily === totalDaily
                    ? "Every objective landed. You're cleared for touchdown."
                    : `${doneDaily} of ${totalDaily} objectives complete. Keep the altitude.`}
              </p>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-5 max-w-md mx-auto md:mx-0">
                <StatChip icon={CheckCircle2} label="Landed" value={`${doneDaily}/${totalDaily || 0}`} tint="primary" />
                <StatChip icon={Flame} label="High-Prio" value={String(highPriority)} tint="destructive" />
                <StatChip icon={TrendingUp} label="Weekly" value={`${doneWeekly}/${totalWeekly || 0}`} tint="accent" />
              </div>
            </div>

            <div className="shrink-0">
              <ProgressRing
                value={pctDaily}
                size={148}
                label={theme === 'war' ? 'Mission' : "Today"}
                sub={upcomingCount > 0 ? `${upcomingCount} upcoming` : undefined}
              />
            </div>
          </div>
        </motion.section>

        {/* Streak */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <StreakCard sessions={studyStore.sessions} />
        </motion.div>

        {/* Focus mode */}
        {focusMode && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <JustTellMeMode
              subjects={store.subjects}
              objectives={store.dailyObjectives}
              onToggle={store.toggleDailyObjective}
              active={focusMode}
              onExit={() => setFocusMode(false)}
            />
          </motion.div>
        )}

        {!focusMode && (
          <>
            {/* Protocols */}
            <motion.div custom={0} initial="hidden" animate="show" variants={fadeUp}>
              <FlightProtocols protocols={store.protocols} onAdd={store.addProtocol} onRemove={store.removeProtocol} />
            </motion.div>

            {/* AI */}
            <motion.div custom={1} initial="hidden" animate="show" variants={fadeUp}>
              <AIAdvisor state={{ subjects: store.subjects, weeklyTargets: store.weeklyTargets, dailyObjectives: store.dailyObjectives, commitments: store.commitments, protocols: store.protocols, events: store.events }} />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <motion.div custom={2} initial="hidden" animate="show" variants={fadeUp}>
                  <SubjectManager subjects={store.subjects} onAdd={store.addSubject} onRemove={store.removeSubject} />
                </motion.div>
                <motion.div custom={3} initial="hidden" animate="show" variants={fadeUp}>
                  <WeeklyTargets
                    subjects={store.subjects}
                    targets={store.weeklyTargets}
                    pastTargets={store.pastWeeklyTargets}
                    onAdd={store.addWeeklyTarget}
                    onToggle={store.toggleWeeklyTarget}
                    onRemove={store.removeWeeklyTarget}
                  />
                </motion.div>
              </div>

              <div className="space-y-6">
                <motion.div custom={4} initial="hidden" animate="show" variants={fadeUp}>
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
                  />
                </motion.div>
                <motion.div custom={5} initial="hidden" animate="show" variants={fadeUp}>
                  <Commitments commitments={store.commitments} onAdd={store.addCommitment} onRemove={store.removeCommitment} />
                </motion.div>
                <motion.div custom={6} initial="hidden" animate="show" variants={fadeUp}>
                  <UpcomingEvents events={store.events} onAdd={store.addEvent} onRemove={store.removeEvent} />
                </motion.div>
              </div>
            </div>
          </>
        )}

        {/* Mobile-only Clear */}
        <div className="sm:hidden pt-2">
          <button
            onClick={store.clearDay}
            className="w-full inline-flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors px-3 py-2.5 rounded-lg border border-border/50 hover:border-destructive/50 hover:bg-destructive/5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {theme === 'war' ? 'Clear Field' : 'Clear Runway'}
          </button>
        </div>
      </main>
    </div>
  );
};

type StatChipProps = { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tint: 'primary' | 'accent' | 'destructive' };
function StatChip({ icon: Icon, label, value, tint }: StatChipProps) {
  const tintClass = tint === 'primary' ? 'text-primary bg-primary/10 border-primary/20'
    : tint === 'accent' ? 'text-accent bg-accent/10 border-accent/20'
    : 'text-destructive bg-destructive/10 border-destructive/20';
  return (
    <div className={`rounded-xl border px-3 py-2.5 flex items-center gap-2.5 ${tintClass}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <div className="min-w-0 text-left">
        <div className="text-[10px] uppercase tracking-widest font-display opacity-80 leading-none">{label}</div>
        <div className="text-sm font-bold tabular-nums mt-0.5 text-foreground">{value}</div>
      </div>
    </div>
  );
}

export default Index;
