import { useState } from 'react';
import { Plus, X, Check, MessageSquare, Compass, Clock, History, ArrowRight, CalendarClock, Flag, Pencil, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Subject, DailyObjective, Priority } from '@/hooks/use-planner-store';
import { useTerms } from '@/lib/terms';

interface DailyObjectivesProps {
  subjects: Subject[];
  objectives: DailyObjective[];
  pastObjectives: DailyObjective[];
  onAdd: (subjectId: string, task: string, minutes: number, deadline?: string, priority?: Priority, initialNote?: string) => void;
  onToggle: (id: string) => void;
  onAddNote: (id: string, note: string) => void;
  onUpdateNotes: (id: string, notes: string[]) => void;
  onUpdatePriority: (id: string, priority: Priority) => void;
  onRemove: (id: string) => void;
  onCarryForward: (id: string, targetDate?: string) => void;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string }> = {
  high: { label: 'High', color: 'text-destructive', bg: 'bg-destructive/20' },
  medium: { label: 'Med', color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
  low: { label: 'Low', color: 'text-muted-foreground', bg: 'bg-muted/30' },
};

const parseNote = (note: string): { text: string; timestamp: string | null } => {
  try {
    const parsed = JSON.parse(note);
    if (parsed && typeof parsed.text === 'string' && typeof parsed.timestamp === 'string') {
      return { text: parsed.text, timestamp: parsed.timestamp };
    }
  } catch {
    // Not JSON — treat as plain text (backward compat)
  }
  return { text: note, timestamp: null };
};

const formatTimestamp = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export function DailyObjectives({ subjects, objectives, pastObjectives, onAdd, onToggle, onAddNote, onUpdateNotes, onUpdatePriority, onRemove, onCarryForward }: DailyObjectivesProps) {
  const t = useTerms();
  const [subjectId, setSubjectId] = useState('');
  const [task, setTask] = useState('');
  const [minutes, setMinutes] = useState('30');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [initialNote, setInitialNote] = useState('');
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [carryForwardId, setCarryForwardId] = useState<string | null>(null);
  const [carryForwardDate, setCarryForwardDate] = useState('');
  const [editingNoteIdx, setEditingNoteIdx] = useState<{ id: string; idx: number } | null>(null);
  const [editNoteValue, setEditNoteValue] = useState('');

  const handleAdd = () => {
    if (subjectId && task.trim()) {
      onAdd(subjectId, task.trim(), parseInt(minutes) || 30, deadline || undefined, priority, initialNote.trim() || undefined);
      setTask('');
      setDeadline('');
      setPriority('medium');
      setInitialNote('');
    }
  };

  const handleAddNote = (id: string) => {
    if (noteInput.trim()) {
      onAddNote(id, noteInput.trim());
      setNoteInput('');
    }
  };

  const handleEditNote = (obj: DailyObjective, idx: number) => {
    const parsed = parseNote(obj.progressNotes[idx]);
    setEditingNoteIdx({ id: obj.id, idx });
    setEditNoteValue(parsed.text);
  };

  const handleSaveEditNote = () => {
    if (!editingNoteIdx) return;
    const obj = [...objectives, ...pastObjectives].find(o => o.id === editingNoteIdx.id);
    if (!obj) return;
    const parsed = parseNote(obj.progressNotes[editingNoteIdx.idx]);
    const updated = [...obj.progressNotes];
    if (editNoteValue.trim()) {
      updated[editingNoteIdx.idx] = JSON.stringify({
        text: editNoteValue.trim(),
        timestamp: parsed.timestamp || new Date().toISOString(),
      });
    } else {
      updated.splice(editingNoteIdx.idx, 1);
    }
    onUpdateNotes(editingNoteIdx.id, updated);
    setEditingNoteIdx(null);
    setEditNoteValue('');
  };

  const handleDeleteNote = (objId: string, idx: number) => {
    const obj = [...objectives, ...pastObjectives].find(o => o.id === objId);
    if (!obj) return;
    const updated = obj.progressNotes.filter((_, i) => i !== idx);
    onUpdateNotes(objId, updated);
  };

  const getSubjectName = (id: string) => subjects.find(s => s.id === id)?.name ?? 'Unknown';
  const completedCount = objectives.filter(o => o.completed).length;
  const totalMinutes = objectives.reduce((sum, o) => sum + o.estimatedMinutes, 0);
  const completedMinutes = objectives.filter(o => o.completed).reduce((sum, o) => sum + o.estimatedMinutes, 0);
  const today = new Date().toISOString().split('T')[0];

  const isOverdue = (o: DailyObjective) => o.deadline && o.deadline < today && !o.completed;

  // Sort by priority: high first, then medium, then low
  const sortByPriority = (list: DailyObjective[]) => {
    const order: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    return [...list].sort((a, b) => order[a.priority] - order[b.priority]);
  };

  const renderObjective = (o: DailyObjective, isPast = false) => {
    const pc = PRIORITY_CONFIG[o.priority];
    return (
      <motion.div
        key={o.id}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        className={`bg-secondary/30 rounded-md overflow-hidden ${isOverdue(o) ? 'ring-1 ring-destructive/50' : ''}`}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button
            onClick={() => onToggle(o.id)}
            className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
              o.completed ? 'bg-primary border-primary' : 'border-muted-foreground hover:border-primary'
            }`}
          >
            {o.completed && <Check className="w-3 h-3 text-primary-foreground" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-sm ${o.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {o.task}
              </span>
              <span className="text-xs text-primary/70 font-display">{getSubjectName(o.subjectId)}</span>
              <span className="text-xs text-muted-foreground">· {o.estimatedMinutes}min</span>
              {isPast && <span className="text-xs text-muted-foreground">· {o.date}</span>}
              {o.deadline && (
                <span className={`text-xs font-display ${isOverdue(o) ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                  · ETA {o.deadline}
                </span>
              )}
            </div>
          </div>
          {/* Priority badge - clickable to cycle */}
          <button
            onClick={() => {
              const cycle: Priority[] = ['low', 'medium', 'high'];
              const next = cycle[(cycle.indexOf(o.priority) + 1) % 3];
              onUpdatePriority(o.id, next);
            }}
            className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded ${pc.bg} ${pc.color} transition-colors`}
            title={`Priority: ${pc.label}`}
          >
            <Flag className="w-3 h-3" />
            <span className="font-display text-[10px]">{pc.label}</span>
          </button>
          <button
            onClick={() => { setActiveNote(activeNote === o.id ? null : o.id); setEditingNoteIdx(null); }}
            className="text-muted-foreground hover:text-primary transition-colors relative"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {o.progressNotes.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
            )}
          </button>
          {!o.completed && (
            <button
              onClick={() => setCarryForwardId(carryForwardId === o.id ? null : o.id)}
              className="text-muted-foreground hover:text-primary transition-colors"
              title="Carry forward"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => onRemove(o.id)} className="text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <AnimatePresence>
          {activeNote === o.id && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-border/50"
            >
              <div className="px-3 py-2.5 space-y-2">
                {o.progressNotes.map((note, i) => (
                  <div key={i} className="flex items-start gap-1.5 group">
                    {editingNoteIdx?.id === o.id && editingNoteIdx?.idx === i ? (
                      <div className="flex-1 flex gap-1.5">
                        <input
                          value={editNoteValue}
                          onChange={e => setEditNoteValue(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveEditNote()}
                          className="flex-1 bg-muted/50 border border-border/50 rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                          autoFocus
                        />
                        <button onClick={handleSaveEditNote} className="text-xs text-primary hover:opacity-80">Save</button>
                        <button onClick={() => setEditingNoteIdx(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const parsed = parseNote(note);
                          return (
                            <div className="flex-1 pl-3 border-l-2 border-primary/30">
                              <p className="text-xs text-muted-foreground">{parsed.text}</p>
                              {parsed.timestamp && (
                                <span className="text-[10px] text-muted-foreground/50 font-display">
                                  {formatTimestamp(parsed.timestamp)}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        <button onClick={() => handleEditNote(o, i)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDeleteNote(o.id, i)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
                <div className="flex gap-2 items-center">
                  <input
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddNote(o.id)}
                    placeholder="Log your progress..."
                    className="flex-1 min-w-0 bg-muted/50 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  <button
                    onClick={() => handleAddNote(o.id)}
                    className="shrink-0 text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
                  >
                    Log
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {carryForwardId === o.id && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-border/50"
            >
              <div className="px-3 py-2.5 flex gap-2 items-center">
                <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Move to:</span>
                <button
                  onClick={() => { onCarryForward(o.id); setCarryForwardId(null); }}
                  className="text-xs bg-primary/20 text-primary px-2 py-1 rounded hover:bg-primary/30 transition-colors"
                >
                  Tomorrow
                </button>
                <input
                  type="date"
                  value={carryForwardDate}
                  onChange={e => setCarryForwardDate(e.target.value)}
                  className="text-xs bg-secondary/50 border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                {carryForwardDate && (
                  <button
                    onClick={() => { onCarryForward(o.id, carryForwardDate); setCarryForwardId(null); setCarryForwardDate(''); }}
                    className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90 transition-opacity"
                  >
                    Move
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const inFlight = sortByPriority(objectives.filter(o => !o.completed));
  const landed = sortByPriority(objectives.filter(o => o.completed));

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-primary" />
          <h3 className="font-display text-sm font-semibold tracking-wide uppercase text-primary">
            Today's Flight
          </h3>
        </div>
        {objectives.length > 0 && (
          <span className="text-xs text-muted-foreground font-display">
            {completedCount}/{objectives.length} landed · {completedMinutes}/{totalMinutes}min
          </span>
        )}
      </div>

      {objectives.length > 0 && (
        <div className="progress-bar mb-4">
          <div
            className="progress-bar-fill"
            style={{ width: `${objectives.length > 0 ? (completedCount / objectives.length) * 100 : 0}%` }}
          />
        </div>
      )}

      {subjects.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <select
            value={subjectId}
            onChange={e => setSubjectId(e.target.value)}
            className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            <option value="">Route</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            value={task}
            onChange={e => setTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Next destination..."
            className="flex-1 min-w-[120px] bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <input
            value={minutes}
            onChange={e => setMinutes(e.target.value)}
            type="number"
            min="5"
            step="5"
            placeholder="min"
            className="w-16 bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <input
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            type="date"
            className="bg-secondary/50 border border-border rounded-md px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as Priority)}
            className="bg-secondary/50 border border-border rounded-md px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Med</option>
            <option value="low">⚪ Low</option>
          </select>
          <button onClick={handleAdd} className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {subjects.length > 0 && (
        <div className="mb-4">
          <input
            value={initialNote}
            onChange={e => setInitialNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Optional note for this objective…"
            className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      )}

      {inFlight.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            In Flight
          </h4>
          <div className="space-y-2">
            <AnimatePresence>
              {inFlight.map(o => renderObjective(o))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {landed.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Landed
          </h4>
          <div className="space-y-2">
            <AnimatePresence>
              {landed.map(o => renderObjective(o))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {objectives.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No flights scheduled for today yet.</p>
      )}

      {pastObjectives.length > 0 && (
        <div className="mt-4 border-t border-border/50 pt-4">
          <button
            onClick={() => setShowPast(!showPast)}
            className="flex items-center gap-2 text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <History className="w-3.5 h-3.5" />
            Flight Log ({pastObjectives.length})
          </button>
          <AnimatePresence>
            {showPast && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2"
              >
                {pastObjectives.map(o => renderObjective(o, true))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
