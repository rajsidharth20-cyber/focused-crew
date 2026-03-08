import { useState } from 'react';
import { Plus, X, Check, MessageSquare, ListChecks } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Subject, DailyObjective } from '@/hooks/use-planner-store';

interface DailyObjectivesProps {
  subjects: Subject[];
  objectives: DailyObjective[];
  onAdd: (subjectId: string, task: string, minutes: number) => void;
  onToggle: (id: string) => void;
  onAddNote: (id: string, note: string) => void;
  onRemove: (id: string) => void;
}

export function DailyObjectives({ subjects, objectives, onAdd, onToggle, onAddNote, onRemove }: DailyObjectivesProps) {
  const [subjectId, setSubjectId] = useState('');
  const [task, setTask] = useState('');
  const [minutes, setMinutes] = useState('30');
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');

  const handleAdd = () => {
    if (subjectId && task.trim()) {
      onAdd(subjectId, task.trim(), parseInt(minutes) || 30);
      setTask('');
    }
  };

  const handleAddNote = (id: string) => {
    if (noteInput.trim()) {
      onAddNote(id, noteInput.trim());
      setNoteInput('');
      setActiveNote(null);
    }
  };

  const getSubjectName = (id: string) => subjects.find(s => s.id === id)?.name ?? 'Unknown';
  const completedCount = objectives.filter(o => o.completed).length;
  const totalMinutes = objectives.reduce((sum, o) => sum + o.estimatedMinutes, 0);
  const completedMinutes = objectives.filter(o => o.completed).reduce((sum, o) => sum + o.estimatedMinutes, 0);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-primary" />
          <h3 className="font-display text-sm font-semibold tracking-wide uppercase text-primary">
            Today's Objectives
          </h3>
        </div>
        {objectives.length > 0 && (
          <span className="text-xs text-muted-foreground font-display">
            {completedCount}/{objectives.length} done · {completedMinutes}/{totalMinutes}min
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
            <option value="">Subject</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            value={task}
            onChange={e => setTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="What needs to be done..."
            className="flex-1 min-w-[150px] bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
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
          <button onClick={handleAdd} className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-2">
        <AnimatePresence>
          {objectives.map(o => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="bg-secondary/30 rounded-md overflow-hidden"
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
                  <span className={`text-sm ${o.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {o.task}
                  </span>
                  <span className="ml-2 text-xs text-primary/70 font-display">{getSubjectName(o.subjectId)}</span>
                  <span className="ml-1 text-xs text-muted-foreground">· {o.estimatedMinutes}min</span>
                </div>
                <button
                  onClick={() => setActiveNote(activeNote === o.id ? null : o.id)}
                  className="text-muted-foreground hover:text-primary transition-colors relative"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {o.progressNotes.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
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
                        <p key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-primary/30">
                          {note}
                        </p>
                      ))}
                      <div className="flex gap-2">
                        <input
                          value={noteInput}
                          onChange={e => setNoteInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddNote(o.id)}
                          placeholder="What did you do on this task?"
                          className="flex-1 bg-muted/50 border border-border/50 rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        <button
                          onClick={() => handleAddNote(o.id)}
                          className="text-xs bg-primary/20 text-primary px-2 py-1.5 rounded hover:bg-primary/30 transition-colors"
                        >
                          Log
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
        {objectives.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No objectives for today yet.</p>
        )}
      </div>
    </div>
  );
}
