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

      {/* Incomplete Objectives */}
      {objectives.filter(o => !o.completed).length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Incomplete Objectives
          </h4>
          <div className="space-y-2">
            <AnimatePresence>
              {objectives.filter(o => !o.completed).map(o => renderObjective(o))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Completed Objectives */}
      {objectives.filter(o => o.completed).length > 0 && (
        <div>
          <h4 className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Completed
          </h4>
          <div className="space-y-2">
            <AnimatePresence>
              {objectives.filter(o => o.completed).map(o => renderObjective(o))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {objectives.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No objectives for today yet.</p>
      )}
    </div>
  );
}
