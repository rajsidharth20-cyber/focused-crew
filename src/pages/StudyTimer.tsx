import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Timer, Hourglass, FileDown, Loader2 } from 'lucide-react';
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
import { DelayPromptHost } from '@/components/study/DelayPromptDialog';
import { useStudyStore } from '@/hooks/use-study-store';
import { usePlannerStore } from '@/hooks/use-planner-store';

type Mode = 'pomodoro' | 'stopwatch';

const StudyTimer = () => {
  const study = useStudyStore();
  const planner = usePlannerStore();
  const { username } = useAuth();
  const [mode, setMode] = useState<Mode>('pomodoro');
  const [tagId, setTagId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [downloadingReport, setDownloadingReport] = useState(false);

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

  const handlePomodoroComplete = (durationSec: number, plannedSec: number, delay: number | null) => {
    const now = new Date();
    const start = new Date(now.getTime() - durationSec * 1000);
    study.addSession({
      ...activeContext(),
      type: 'pomodoro',
      durationSeconds: durationSec,
      plannedSeconds: plannedSec,
      startedAt: start.toISOString(),
      endedAt: now.toISOString(),
      delayMinutes: delay,
    });
    toast.success(`Pomodoro logged · ${Math.round(durationSec / 60)}m${delay ? ` · ${delay}m late` : ''}`);
  };

  const handleStopwatchSave = (durationSec: number, startedAt: string, endedAt: string, delay: number | null) => {
    study.addSession({
      ...activeContext(),
      type: 'stopwatch',
      durationSeconds: durationSec,
      startedAt,
      endedAt,
      delayMinutes: delay,
    });
    toast.success(`Session saved · ${Math.round(durationSec / 60)}m${delay ? ` · ${delay}m late` : ''}`);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <DelayPromptHost />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="aurora animate-float" style={{ width: 480, height: 480, background: 'hsl(var(--primary) / 0.28)', top: -140, left: -120 }} />
        <div className="aurora animate-float" style={{ width: 520, height: 520, background: 'hsl(var(--accent) / 0.25)', top: 120, right: -160, animationDelay: '1.5s' }} />
      </div>

      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/60 border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="p-2 rounded-lg hover:bg-secondary transition" aria-label="Back">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="relative w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg shrink-0">
              <Timer className="w-5 h-5 text-primary-foreground" />
              <span className="absolute -inset-0.5 rounded-xl bg-gradient-primary opacity-40 blur-md -z-10" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-bold tracking-tight truncate">Study Timer</h1>
              <p className="text-[11px] text-muted-foreground truncate">Focus, log, analyze.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadWeekly}
              disabled={downloadingReport}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-primary/40 text-primary hover:bg-primary/10 transition disabled:opacity-50"
              aria-label="Download weekly report as PDF"
            >
              {downloadingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Weekly report</span>
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

        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="glass-card p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Topic</label>
                <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="What are you focusing on?" className="w-full mt-1 bg-background border border-border/60 rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Tag</label>
                <select value={tagId} onChange={e => setTagId(e.target.value)} className="w-full mt-1 bg-background border border-border/60 rounded-md px-3 py-2 text-sm">
                  <option value="">— No tag —</option>
                  {study.tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Subject</label>
                <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-full mt-1 bg-background border border-border/60 rounded-md px-3 py-2 text-sm">
                  <option value="">— No subject —</option>
                  {planner.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
              When you press <span className="font-semibold text-foreground">Start</span> below, you'll be asked how many minutes late you are so your punctuality can be tracked.
            </p>
          </div>
        </motion.div>

        <div className="inline-flex rounded-xl border border-border/60 p-1 bg-background/60 backdrop-blur">
          <ModeButton active={mode === 'pomodoro'} onClick={() => setMode('pomodoro')} icon={Hourglass} label="Pomodoro" />
          <ModeButton active={mode === 'stopwatch'} onClick={() => setMode('stopwatch')} icon={Timer} label="Stopwatch" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {mode === 'pomodoro'
              ? <PomodoroTimer onComplete={handlePomodoroComplete} />
              : <StopwatchTimer onSave={handleStopwatchSave} />}
            <SessionList sessions={study.sessions} tags={study.tags} subjects={planner.subjects} onRemove={study.removeSession} onUpdate={study.updateSession} />
          </div>
          <div className="space-y-6">
            <StudyObjectivesPanel subjects={planner.subjects} objectives={planner.dailyObjectives} onToggle={planner.toggleDailyObjective} />
            <TagManager tags={study.tags} onAdd={study.addTag} onUpdate={study.updateTag} onRemove={study.removeTag} />
          </div>
        </div>

        <StudyStats
          sessions={study.sessions}
          tags={study.tags}
          subjects={planner.subjects}
          objectives={planner.dailyObjectives}
          pastObjectives={planner.pastObjectives}
        />
      </main>
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
