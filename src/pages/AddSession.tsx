import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Clock, Tag, BookOpen, Calendar, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useStudyStore } from '@/hooks/use-study-store';
import { usePlannerStore } from '@/hooks/use-planner-store';
import { BottomNav } from '@/components/shell/BottomNav';

const nowLocalInput = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function AddSession() {
  const navigate = useNavigate();
  const study = useStudyStore();
  const planner = usePlannerStore();

  const [tagId, setTagId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [startedAt, setStartedAt] = useState(nowLocalInput());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (minutes <= 0) return;
    setBusy(true);
    const startDate = new Date(startedAt);
    const endDate = new Date(startDate.getTime() + minutes * 60 * 1000);
    const saved = await study.addSession({
      tagId: tagId || null,
      subjectId: subjectId || null,
      topic: topic.trim() || 'Manual entry',
      type: 'manual',
      durationSeconds: minutes * 60,
      plannedSeconds: null,
      startedAt: startDate.toISOString(),
      endedAt: endDate.toISOString(),
      notes: notes.trim() || null,
      delayMinutes: null,
    });
    setBusy(false);
    if (saved) {
      toast.success('Session added');
      navigate('/study');
    } else {
      toast.error('Could not save session');
    }
  };

  const presetMinutes = [15, 25, 30, 45, 60, 90, 120];

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
        <div className="aurora animate-float" style={{ width: 420, height: 420, background: 'hsl(var(--primary) / 0.22)', top: -140, left: -120 }} />
        <div className="aurora animate-float" style={{ width: 460, height: 460, background: 'hsl(var(--accent) / 0.18)', top: 180, right: -160, animationDelay: '1.5s' }} />
      </div>

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/study')}
            className="press inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-border/60 hover:bg-muted/40 transition"
            aria-label="Back to timer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <div className="min-w-0 text-right">
            <h1 className="font-display text-[17px] font-bold tracking-tight leading-none truncate">Add session</h1>
            <p className="text-[10.5px] text-muted-foreground truncate mt-1">Log study time you forgot to track.</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="glass-card p-5 space-y-5"
        >
          <div className="flex items-center gap-3 pb-2 border-b border-border/40">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Plus className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[16px] font-semibold">Manual session</h2>
              <p className="text-[11.5px] text-muted-foreground">Fill the details below and save.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Duration
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {presetMinutes.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMinutes(m)}
                    className={`press rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition ${
                      minutes === m
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border/60 text-muted-foreground hover:bg-secondary/60'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                value={minutes}
                onChange={e => setMinutes(Math.max(1, Number(e.target.value) || 1))}
                className="w-full mt-3 bg-background/70 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/50 tabular-nums"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Topic
              </label>
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="What did you study?"
                className="w-full mt-2 bg-background/70 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Tag className="w-3 h-3" /> Tag
                </label>
                <select
                  value={tagId}
                  onChange={e => setTagId(e.target.value)}
                  className="w-full mt-2 bg-background/70 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="">— No tag —</option>
                  {study.tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3" /> Subject
                </label>
                <select
                  value={subjectId}
                  onChange={e => setSubjectId(e.target.value)}
                  className="w-full mt-2 bg-background/70 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="">— No subject —</option>
                  {planner.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Started at
                </label>
                <input
                  type="datetime-local"
                  value={startedAt}
                  onChange={e => setStartedAt(e.target.value)}
                  className="w-full mt-2 bg-background/70 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Ended at
                </label>
                <input
                  type="text"
                  readOnly
                  value={(() => {
                    const startDate = new Date(startedAt);
                    const endDate = new Date(startDate.getTime() + minutes * 60 * 1000);
                    return endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  })()}
                  className="w-full mt-2 bg-background/40 border border-border/40 rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anything worth noting about this session?"
                rows={3}
                className="w-full mt-2 bg-background/70 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => navigate('/study')}
              className="press flex-1 rounded-xl border border-border/60 px-4 py-3 text-sm hover:bg-secondary transition"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || minutes <= 0}
              className="press flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md disabled:opacity-50"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Save session
                </>
              )}
            </button>
          </div>
        </motion.div>
      </main>

      <BottomNav />
    </div>
  );
}
