import { motion } from 'framer-motion';
import { Plane, Swords, Sparkles, Flame, TrendingUp, CheckCircle2, FileDown, Loader2, Timer, Home, Bot, MoreHorizontal, Trash2, LogOut, PlusCircle, CalendarDays, MessagesSquare, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUnreadMessages } from '@/hooks/use-unread-messages';
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { generateDailySummaryPDF } from '@/lib/daily-summary-pdf';
import { SettingsDialog } from '@/components/SettingsDialog';
import { ShareAppButton } from '@/components/ShareAppButton';
import { ProfileDialog } from '@/components/ProfileDialog';
import { useTheme } from '@/hooks/use-theme';
import { useTerms } from '@/lib/terms';
import { SubjectManager } from '@/components/SubjectManager';
import { WeeklyTargets } from '@/components/WeeklyTargets';
import { DailyObjectives } from '@/components/DailyObjectives';
import { Commitments } from '@/components/Commitments';
import { UpcomingEvents } from '@/components/UpcomingEvents';
import { FlightProtocols } from '@/components/FlightProtocols';
import { AIAdvisor } from '@/components/AIAdvisor';
import { DailyNote } from '@/components/DailyNote';
import { UsernamePrompt } from '@/components/UsernamePrompt';
import { ProgressRing } from '@/components/ProgressRing';
import { StreakCard } from '@/components/StreakCard';
import { JustTellMeMode, JustTellMeToggle } from '@/components/JustTellMeMode';
import { usePlannerStore } from '@/hooks/use-planner-store';
import { useStudyStore } from '@/hooks/use-study-store';
import { useAuth } from '@/hooks/useAuth';
import { useEventReminders } from '@/hooks/use-event-reminders';
import { useNow } from '@/hooks/use-now';
import { QuoteCard } from '@/components/QuoteCard';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

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
  const t = useTerms();
  useEventReminders(store.events);
  const now = useNow(30_000);
  const clock = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { total: unreadTotal } = useUnreadMessages();
  const dailyRef = useRef<HTMLDivElement>(null);
  const advisorRef = useRef<HTMLDivElement>(null);

  const handleDownloadSummary = async () => {
    setDownloadingPdf(true);
    const toastId = toast.loading('Preparing your daily summary…');
    try {
      await generateDailySummaryPDF({
        username,
        subjects: store.subjects,
        dailyObjectives: store.dailyObjectives,
        weeklyTargets: store.weeklyTargets,
        commitments: store.commitments,
        events: store.events,
      });
      toast.success('Summary downloaded', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Could not generate PDF', { id: toastId });
    } finally {
      setDownloadingPdf(false);
      setMoreOpen(false);
    }
  };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const ThemeIcon = theme === 'war' ? Swords : Plane;

  const totalDaily = store.dailyObjectives.length;
  const doneDaily = store.dailyObjectives.filter(o => o.completed).length;
  const pctDaily = totalDaily > 0 ? (doneDaily / totalDaily) * 100 : 0;
  const totalWeekly = store.weeklyTargets.length;
  const doneWeekly = store.weeklyTargets.filter(x => x.completed).length;
  const upcomingCount = store.events.length;
  const highPriority = store.dailyObjectives.filter(o => !o.completed && o.priority === 'high').length;

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToDaily = () => dailyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const scrollToAdvisor = () => advisorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div
      className="relative min-h-screen overflow-x-hidden pb-[calc(80px+env(safe-area-inset-bottom))]"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Ambient auroras */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="aurora animate-float" style={{ width: 360, height: 360, background: 'hsl(var(--primary) / 0.28)', top: -120, left: -100 }} />
        <div className="aurora animate-float" style={{ width: 400, height: 400, background: 'hsl(var(--accent) / 0.22)', top: 200, right: -140, animationDelay: '1.5s' }} />
      </div>

      {username === null && <UsernamePrompt />}

      {/* App top bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/75 border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <button onClick={scrollTop} className="flex items-center gap-2.5 min-w-0 active:scale-[0.98] transition-transform">
            <div className="relative w-9 h-9 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-md shrink-0">
              <ThemeIcon className="w-4 h-4 text-primary-foreground" />
              <span className="absolute -inset-0.5 rounded-2xl bg-gradient-primary opacity-40 blur-md -z-10" />
            </div>
            <div className="min-w-0 text-left">
              <h1 className="font-display text-[15px] font-bold tracking-tight leading-none truncate">Task Pilot</h1>
              <p className="text-[10.5px] text-muted-foreground truncate mt-0.5">{today}</p>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <div className="flex items-center px-2 py-1 rounded-full bg-secondary/60 border border-border/40 mr-1">
              <span className="text-[11px] font-display font-semibold tabular-nums text-foreground">{clock}</span>
            </div>
            <JustTellMeToggle active={focusMode} onClick={() => setFocusMode(v => !v)} />
            <ProfileDialog />
            <SettingsDialog />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
        <QuoteCard />

        {/* HERO */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="glass-card glow-sky p-5 sm:p-8 overflow-hidden relative"
        >
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
            <div className="flex-1 min-w-0 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-display text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-3">
                <Sparkles className="w-3 h-3" />
                {t.heroBadge}
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight">
                {t.greeting(new Date().getHours())}
                {username ? <>, <span className="text-gradient">{username}</span></> : ''}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-md mx-auto md:mx-0">
                {totalDaily === 0
                  ? 'Nothing planned yet. Add your first task to get started.'
                  : doneDaily === totalDaily
                    ? "Everything done. Nice work."
                    : `${doneDaily} of ${totalDaily} tasks complete. Keep going.`}
              </p>

              <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-5 max-w-md mx-auto md:mx-0">
                <StatChip icon={CheckCircle2} label={t.done} value={`${doneDaily}/${totalDaily || 0}`} tint="primary" />
                <StatChip icon={Flame} label="High" value={String(highPriority)} tint="destructive" />
                <StatChip icon={TrendingUp} label="Weekly" value={`${doneWeekly}/${totalWeekly || 0}`} tint="accent" />
              </div>
            </div>

            <div className="shrink-0">
              <ProgressRing
                value={pctDaily}
                size={148}
                label={t.ringLabel}
                sub={upcomingCount > 0 ? `${upcomingCount} upcoming` : undefined}
              />
            </div>
          </div>
        </motion.section>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <StreakCard sessions={studyStore.sessions} />
        </motion.div>

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
            <motion.div custom={0} initial="hidden" animate="show" variants={fadeUp}>
              <FlightProtocols protocols={store.protocols} onAdd={store.addProtocol} onRemove={store.removeProtocol} />
            </motion.div>

            <motion.div ref={advisorRef} custom={1} initial="hidden" animate="show" variants={fadeUp}>
              <AIAdvisor state={{ subjects: store.subjects, weeklyTargets: store.weeklyTargets, dailyObjectives: store.dailyObjectives, commitments: store.commitments, protocols: store.protocols, events: store.events }} />
            </motion.div>

            <motion.div custom={2} initial="hidden" animate="show" variants={fadeUp}>
              <DailyNote />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-5">
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

              <div className="space-y-5">
                <motion.div ref={dailyRef} custom={4} initial="hidden" animate="show" variants={fadeUp}>
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
      </main>

      {/* Bottom app tab bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 border-t border-border/50 bg-background/85 backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="relative max-w-6xl mx-auto grid grid-cols-5 h-[64px]">
          <CenterAdd onClick={scrollToDaily} />
          <TabButton icon={Home} label="Home" onClick={scrollTop} />
          <TabButton icon={CalendarDays} label="Planner" to="/planner" />
          <TabButton icon={Timer} label="Timer" to="/study" />
          <TabButton icon={MessagesSquare} label="Chats" to="/chat" badge={unreadTotal} />
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground active:scale-95 transition">
                <MoreHorizontal className="w-5 h-5" />
                <span className="text-[10px] font-medium">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl border-border/60 bg-background/95 backdrop-blur-xl">
              <SheetHeader>
                <SheetTitle className="text-left">Quick actions</SheetTitle>
              </SheetHeader>
              <div className="mt-4 grid grid-cols-1 gap-1.5">
                <SheetAction icon={Users} label="Study groups" onClick={() => { setMoreOpen(false); window.location.assign('/groups'); }} />
                <SheetAction icon={FileDown} label="Download summary PDF" onClick={handleDownloadSummary} disabled={downloadingPdf} loading={downloadingPdf} />

                <div className="px-3 py-2 flex items-center justify-between gap-3 rounded-xl hover:bg-secondary/60">
                  <div className="flex items-center gap-3 text-sm text-foreground">
                    <ShareAppButton />
                    <span>Share app link</span>
                  </div>
                </div>
                <SheetAction icon={Trash2} label={t.clear} onClick={() => { store.clearDay(); setMoreOpen(false); }} destructive />
                <SheetAction icon={LogOut} label={t.logout} onClick={() => { signOut(); setMoreOpen(false); }} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
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

type TabProps = { icon: React.ComponentType<{ className?: string }>; label: string; onClick?: () => void; to?: string; badge?: number };
function TabButton({ icon: Icon, label, onClick, to, badge }: TabProps) {
  const cls = 'relative flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-primary active:scale-95 transition';
  const badgeEl = badge && badge > 0 ? (
    <span className="absolute top-1.5 right-[22%] min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold grid place-items-center">
      {badge > 9 ? '9+' : badge}
    </span>
  ) : null;
  if (to) {
    return (
      <Link to={to} className={cls}>
        <Icon className="w-5 h-5" />
        <span className="text-[10px] font-medium">{label}</span>
        {badgeEl}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function CenterAdd({ onClick }: { onClick: () => void }) {
  return (
    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-3 z-10">
      <button
        onClick={onClick}
        aria-label="Add task"
        className="pointer-events-auto w-14 h-14 rounded-full bg-gradient-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center active:scale-95 transition"
      >
        <PlusCircle className="w-6 h-6" />
      </button>
    </div>
  );
}

function SheetAction({ icon: Icon, label, onClick, destructive, disabled, loading }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; destructive?: boolean; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-left transition-colors hover:bg-secondary/60 disabled:opacity-50 ${destructive ? 'text-destructive' : 'text-foreground'}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      <span className="flex-1">{label}</span>
    </button>
  );
}

export default Index;
