import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Hourglass, FileDown, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { generateWeeklyReportPDF } from '@/lib/weekly-report-pdf';
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

type Mode = 'pomodoro' | 'stopwatch';

const FULLSCREEN_KEY = 'taskpilot_study_fullscreen_v1';

const StudyTimer = () => {
  const study = useStudyStore();
  const planner = usePlannerStore();
  const { username } = useAuth();
  const [mode, setMode] = useState<Mode>('pomodoro');
  const [tagId, setTagId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [noteSession, setNoteSession] = useState<StudySession | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [fullscreen, setFullscreen] = useState(() => localStorage.getItem(FULLSCREEN_KEY) === '1');
  const immersive = mode === 'pomodoro' && timerRunning;

  useEffect(() => {
    localStorage.setItem(FULLSCREEN_KEY, fullscreen ? '1' : '0');
  }, [fullscreen]);


  const handleDownloadWeekly = async () => {
    setDownloadingReport(true);
    const t = toast.loading('Building your weekly report…');
    try {
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
      : <StopwatchTimer onSave={handleStopwatchSave} />;

  const contextChips = (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {topic && <span className="m3-chip">{topic}</span>}
      {subjectId && <span className="m3-chip">{planner.subjects.find(s => s.id === subjectId)?.name}</span>}
      {tagId && <span className="m3-chip">{study.tags.find(t => t.id === tagId)?.name}</span>}
    </div>
  );

  if (fullscreen) {
    return (
      <div
        className="fixed inset-0 z-50 overflow-y-auto app-surface"
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
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="aurora animate-float" style={{ width: 460, height: 460, background: 'hsl(var(--primary) / 0.26)', top: -160, left: -140 }} />
          <div className="aurora animate-float" style={{ width: 480, height: 480, background: 'hsl(var(--accent) / 0.2)', bottom: -180, right: -160, animationDelay: '1.5s' }} />
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-3 pb-8 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-[17px] font-bold tracking-tight leading-none truncate">Full screen study</h1>
              <p className="text-[10.5px] text-muted-foreground mt-1">Your timer, your groups, your crew.</p>
            </div>
            <button
              onClick={() => setFullscreen(false)}
              className="press inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-border/60 hover:bg-muted/40 transition"
              aria-label="Exit full screen study mode"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              Normal
            </button>
          </div>

          {!timerRunning && (
            <div className="inline-flex rounded-2xl border border-border/60 p-1 bg-background/60 backdrop-blur">
              <ModeButton active={mode === 'pomodoro'} onClick={() => setMode('pomodoro')} icon={Hourglass} label="Pomodoro" />
              <ModeButton active={mode === 'stopwatch'} onClick={() => setMode('stopwatch')} icon={Timer} label="Stopwatch" />
            </div>
          )}

          {contextChips}

          <motion.div layout transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
            {timerEl}
          </motion.div>

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
          {!immersive && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFullscreen(true)}
                className="press inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-border/60 hover:bg-muted/40 transition"
                aria-label="Switch to full screen study mode"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Full screen</span>
              </button>
              <button

                onClick={handleDownloadWeekly}
                disabled={downloadingReport}
                className="press inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition disabled:opacity-50"
                aria-label="Download weekly report as PDF"
              >
                {downloadingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Weekly</span>
              </button>
              <ManualSessionDialog
                tags={study.tags}
                subjects={planner.subjects}
                onSave={(input) => {
                  study.addSession({ ...input, type: 'manual', plannedSeconds: null });
                  toast.success('Session added');
                }}
              />
            </div>
          )}
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
          {mode === 'pomodoro'
            ? <PomodoroTimer onComplete={handlePomodoroComplete} onRunningChange={setTimerRunning} />
            : <StopwatchTimer onSave={handleStopwatchSave} />}
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

export default StudyTimer;
