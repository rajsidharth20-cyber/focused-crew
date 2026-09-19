import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Hourglass, FileDown, Loader2, Maximize2, Minimize2, Palette, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { PomodoroTimer } from '@/components/study/PomodoroTimer';
import { StopwatchTimer } from '@/components/study/StopwatchTimer';
import { TagManager } from '@/components/study/TagManager';
import { ManualSessionDialog } from '@/components/study/ManualSessionDialog';
import { StudyStats } from '@/components/study/StudyStats';
import { SessionList } from '@/components/study/SessionList';
import { StudyObjectivesPanel } from '@/components/study/StudyObjectivesPanel';
import { SessionNotesDialog } from '@/components/study/SessionNotesDialog';
import { DelayPromptHost } from '@/components/study/DelayPromptDialog';
import { LiveStudyPanel } from '@/components/study/LiveStudyPanel';
import { useStudyStore, type StudySession } from '@/hooks/use-study-store';
import { usePlannerStore } from '@/hooks/use-planner-store';
import { BottomNav } from '@/components/shell/BottomNav';
import { useTheme } from '@/hooks/use-theme';

type Mode = 'pomodoro' | 'stopwatch';

const StudyTimer = () => {
  const study = useStudyStore();
  const planner = usePlannerStore();
  const { username } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const [mode, setMode] = useState<Mode>('pomodoro');
  const [tagId, setTagId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [noteSession, setNoteSession] = useState<StudySession | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const allowAutomaticFullscreen = useRef(true);
  const idleResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const immersive = timerRunning;

  useEffect(() => {
    if (idleResetTimer.current) {
      clearTimeout(idleResetTimer.current);
      idleResetTimer.current = null;
    }

    if (timerRunning) {
      if (allowAutomaticFullscreen.current) setFullscreen(true);
      return;
    }

    // Timer variants remount when leaving full screen and briefly report idle
    // before restoring persisted state. Wait before enabling automatic entry again.
    idleResetTimer.current = setTimeout(() => {
      allowAutomaticFullscreen.current = true;
      idleResetTimer.current = null;
    }, 150);

    return () => {
      if (idleResetTimer.current) clearTimeout(idleResetTimer.current);
    };
  }, [timerRunning]);

  const exitFullscreen = () => {
    allowAutomaticFullscreen.current = false;
    setThemePickerOpen(false);
    setFullscreen(false);
  };

  const enterFullscreen = () => {
    allowAutomaticFullscreen.current = true;
    setFullscreen(true);
  };


  const handleDownloadWeekly = async () => {
    setDownloadingReport(true);
    const t = toast.loading('Building your weekly report…');
    try {
      const { generateWeeklyReportPDF } = await import('@/lib/weekly-report-pdf');
      await generateWeeklyReportPDF({
        username,
        sessions: study.sessions,
        tags: study.tags,
        subjects: planner.subjects,
        dailyObjectives: planner.dailyObjectives,
        pastObjectives: planner.pastObjectives,
      });
      toast.success('Weekly report downloaded', { id: t });
    } catch (e) {
      console.error(e);
      toast.error('Could not generate report', { id: t });
    } finally {
      setDownloadingReport(false);
    }
  };


  const activeContext = () => ({
    tagId: tagId || null,
    subjectId: subjectId || null,
    topic: topic.trim() || null,
  });

  const handlePomodoroComplete = async (durationSec: number, plannedSec: number, delay: number | null) => {
    const now = new Date();
    const start = new Date(now.getTime() - durationSec * 1000);
    const saved = await study.addSession({
      ...activeContext(),
      type: 'pomodoro',
      durationSeconds: durationSec,
      plannedSeconds: plannedSec,
      startedAt: start.toISOString(),
      endedAt: now.toISOString(),
      delayMinutes: delay,
    });
    toast.success(`Pomodoro logged · ${Math.round(durationSec / 60)}m${delay ? ` · ${delay}m late` : ''}`);
    if (saved) setNoteSession(saved);
  };

  const handleStopwatchSave = async (durationSec: number, startedAt: string, endedAt: string, delay: number | null) => {
    const saved = await study.addSession({
      ...activeContext(),
      type: 'stopwatch',
      durationSeconds: durationSec,
      startedAt,
      endedAt,
      delayMinutes: delay,
    });
    toast.success(`Session saved · ${Math.round(durationSec / 60)}m${delay ? ` · ${delay}m late` : ''}`);
    if (saved) setNoteSession(saved);
  };

  const timerEl =
    mode === 'pomodoro'
      ? <PomodoroTimer onComplete={handlePomodoroComplete} onRunningChange={setTimerRunning} />
      : <StopwatchTimer onSave={handleStopwatchSave} onRunningChange={setTimerRunning} />;

  const contextLines = [
    topic || null,
    planner.subjects.find(s => s.id === subjectId)?.name || study.tags.find(t => t.id === tagId)?.name || null,
  ];

  const heroTimerEl =
    mode === 'pomodoro'
      ? <PomodoroTimer variant="hero" contextLines={contextLines} onComplete={handlePomodoroComplete} onRunningChange={setTimerRunning} />
      : <StopwatchTimer variant="hero" contextLines={contextLines} onRunningChange={setTimerRunning} onSave={handleStopwatchSave} />;




  if (fullscreen) {
    return (
      <div
        className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden study-room"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        <DelayPromptHost />
        <SessionNotesDialog
          session={noteSession}
          onClose={() => setNoteSession(null)}
          onSave={(id, notes) => study.updateSession(id, { notes })}
        />

        {/* Slow, barely-there ambient movement */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="study-room-glow study-room-glow--one" />
          <div className="study-room-glow study-room-glow--two" />
        </div>

        <div className="max-w-md mx-auto px-5 pt-4 pb-10">
          <div className="relative flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Study room</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setThemePickerOpen(open => !open)}
                className="press grid h-8 w-8 place-items-center rounded-full border border-foreground/10 bg-foreground/[0.04] text-muted-foreground transition hover:text-foreground"
                aria-label="Choose study theme"
                aria-expanded={themePickerOpen}
              >
                <Palette className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={exitFullscreen}
                className="press inline-flex items-center gap-1.5 text-[11.5px] px-3 py-1.5 rounded-full border border-foreground/10 bg-foreground/[0.04] text-muted-foreground hover:text-foreground transition"
                aria-label="Exit full screen study mode"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                Exit
              </button>
            </div>

            <AnimatePresence>
              {themePickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 top-11 z-20 w-[min(19rem,calc(100vw-2.5rem))] rounded-2xl border border-border/60 bg-popover/95 p-2.5 shadow-xl backdrop-blur-xl"
                >
                  <p className="px-1 pb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Study theme</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {themes.map(option => (
                      <button
                        key={option.key}
                        onClick={() => {
                          setTheme(option.key);
                          setThemePickerOpen(false);
                        }}
                        className={`press relative flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2 text-center transition ${
                          theme === option.key ? 'border-primary bg-primary/10' : 'border-border/50 bg-card/50 hover:bg-secondary/60'
                        }`}
                        aria-label={`Use ${option.name} theme`}
                      >
                        <span className="flex h-5 w-10 overflow-hidden rounded-full border border-border/50" aria-hidden>
                          {option.swatch.map(color => <span key={color} className="flex-1" style={{ background: color }} />)}
                        </span>
                        <span className="max-w-full truncate text-[10.5px] font-medium">{option.name}</span>
                        {theme === option.key && <Check className="absolute right-1 top-1 h-3 w-3 text-primary" />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.div
            layout
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="flex flex-col items-center pt-8 pb-9"
          >
            {heroTimerEl}
          </motion.div>

          <AnimatePresence initial={false}>
            {!timerRunning && (
              <motion.div
                key="mode"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden flex justify-center pb-8"
              >
                <div className="inline-flex rounded-full border border-foreground/10 bg-foreground/[0.04] p-1 backdrop-blur">
                  <HeroModeButton active={mode === 'pomodoro'} onClick={() => setMode('pomodoro')} icon={Hourglass} label="Pomodoro" />
                  <HeroModeButton active={mode === 'stopwatch'} onClick={() => setMode('stopwatch')} icon={Timer} label="Stopwatch" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <LiveStudyPanel />
        </div>
      </div>
    );
  }


  return (

    <div
      className="relative min-h-screen overflow-x-hidden app-surface"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <DelayPromptHost />
      <SessionNotesDialog
        session={noteSession}
        onClose={() => setNoteSession(null)}
        onSave={(id, notes) => study.updateSession(id, { notes })}
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="aurora animate-float" style={{ width: 420, height: 420, background: 'hsl(var(--primary) / 0.24)', top: -140, left: -120 }} />
        <div className="aurora animate-float" style={{ width: 460, height: 460, background: 'hsl(var(--accent) / 0.2)', top: 180, right: -160, animationDelay: '1.5s' }} />
      </div>

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[17px] font-bold tracking-tight leading-none truncate">
              {immersive ? 'Focus mode' : 'Timer'}
            </h1>
            <p className="text-[10.5px] text-muted-foreground truncate mt-1">
              {immersive ? 'Stay with it — everything else is hidden.' : 'Focus, log, analyze.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
              <button
                onClick={enterFullscreen}
                className="press inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-border/60 hover:bg-muted/40 transition"
                aria-label="Switch to full screen study mode"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Full screen</span>
              </button>
            {!immersive && (
              <>
              <button

                onClick={handleDownloadWeekly}
                disabled={downloadingReport}
                className="press inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition disabled:opacity-50"
                aria-label="Download weekly report as PDF"
              >
                {downloadingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Weekly</span>
              </button>
              <ManualSessionDialog tags={study.tags} subjects={planner.subjects} />
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-3 space-y-4">
        <AnimatePresence initial={false}>
          {!immersive && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="overflow-hidden space-y-4"
            >
              <div className="glass-card p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Topic</label>
                    <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="What are you focusing on?" className="w-full mt-1 bg-background border border-border/60 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Tag</label>
                    <select value={tagId} onChange={e => setTagId(e.target.value)} className="w-full mt-1 bg-background border border-border/60 rounded-xl px-3 py-2 text-sm">
                      <option value="">— No tag —</option>
                      {study.tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Subject</label>
                    <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-full mt-1 bg-background border border-border/60 rounded-xl px-3 py-2 text-sm">
                      <option value="">— No subject —</option>
                      {planner.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                  When you press <span className="font-semibold text-foreground">Start</span>, you'll be asked how many minutes late you are so your punctuality can be tracked.
                </p>
              </div>

              <div className="inline-flex rounded-2xl border border-border/60 p-1 bg-background/60 backdrop-blur">
                <ModeButton active={mode === 'pomodoro'} onClick={() => setMode('pomodoro')} icon={Hourglass} label="Pomodoro" />
                <ModeButton active={mode === 'stopwatch'} onClick={() => setMode('stopwatch')} icon={Timer} label="Stopwatch" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {immersive && (
          <div className="flex flex-wrap gap-1.5 justify-center pt-2">
            {topic && <span className="m3-chip">{topic}</span>}
            {subjectId && <span className="m3-chip">{planner.subjects.find(s => s.id === subjectId)?.name}</span>}
            {tagId && <span className="m3-chip">{study.tags.find(t => t.id === tagId)?.name}</span>}
          </div>
        )}

        <motion.div layout transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
          {timerEl}

        </motion.div>

        {!immersive && (
          <>
            <StudyObjectivesPanel subjects={planner.subjects} objectives={planner.dailyObjectives} onToggle={planner.toggleDailyObjective} />

            <StudyStats
              sessions={study.sessions}
              tags={study.tags}
              subjects={planner.subjects}
              objectives={planner.dailyObjectives}
              pastObjectives={planner.pastObjectives}
            />

            <SessionList sessions={study.sessions} tags={study.tags} subjects={planner.subjects} onRemove={study.removeSession} onUpdate={study.updateSession} />

            <TagManager tags={study.tags} onAdd={study.addTag} onUpdate={study.updateTag} onRemove={study.removeTag} />
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};


function ModeButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${active ? 'bg-gradient-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
    >
      <Icon className="w-4 h-4" />{label}
    </button>
  );
}

function HeroModeButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`press inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] font-medium transition ${
        active ? 'bg-foreground/[0.10] text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />{label}
    </button>
  );
}

export default StudyTimer;
