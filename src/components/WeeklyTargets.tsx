import { useState } from 'react';
import { Plus, X, Check, Target, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Subject, WeeklyTarget } from '@/hooks/use-planner-store';

interface WeeklyTargetsProps {
  subjects: Subject[];
  targets: WeeklyTarget[];
  pastTargets: WeeklyTarget[];
  onAdd: (subjectId: string, target: string, deadline?: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

export function WeeklyTargets({ subjects, targets, pastTargets, onAdd, onToggle, onRemove }: WeeklyTargetsProps) {
  const [subjectId, setSubjectId] = useState('');
  const [input, setInput] = useState('');
  const [deadline, setDeadline] = useState('');
  const [showPast, setShowPast] = useState(false);

  const handleAdd = () => {
    if (subjectId && input.trim()) {
      onAdd(subjectId, input.trim(), deadline || undefined);
      setInput('');
      setDeadline('');
    }
  };

  const getSubjectName = (id: string) => subjects.find(s => s.id === id)?.name ?? 'Unknown';
  const today = new Date().toISOString().split('T')[0];

  const renderTarget = (t: WeeklyTarget, isPast = false) => (
    <motion.div
      key={t.id}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className={`flex items-center gap-3 bg-secondary/30 rounded-md px-3 py-2.5 ${
        t.deadline && t.deadline < today && !t.completed ? 'ring-1 ring-destructive/50' : ''
      }`}
    >
      <button
        onClick={() => onToggle(t.id)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          t.completed ? 'bg-primary border-primary' : 'border-muted-foreground hover:border-primary'
        }`}
      >
        {t.completed && <Check className="w-3 h-3 text-primary-foreground" />}
      </button>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${t.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {t.target}
        </span>
        <span className="ml-2 text-xs text-primary/70 font-display">{getSubjectName(t.subjectId)}</span>
        {t.deadline && (
          <span className={`ml-1 text-xs font-display ${
            t.deadline < today && !t.completed ? 'text-destructive font-semibold' : 'text-muted-foreground'
          }`}>
            · Due {t.deadline}
          </span>
        )}
      </div>
      <button onClick={() => onRemove(t.id)} className="text-muted-foreground hover:text-destructive transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-primary" />
        <h3 className="font-display text-sm font-semibold tracking-wide uppercase text-primary">
          Weekly Targets
        </h3>
      </div>
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
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Weekly target..."
            className="flex-1 min-w-[120px] bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <input
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            type="date"
            className="bg-secondary/50 border border-border rounded-md px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button onClick={handleAdd} className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="space-y-2">
        <AnimatePresence>
          {targets.map(t => renderTarget(t))}
        </AnimatePresence>
        {targets.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No weekly targets yet. Add subjects first, then set targets.</p>
        )}
      </div>

      {/* Past Targets */}
      {pastTargets.length > 0 && (
        <div className="mt-4 border-t border-border/50 pt-4">
          <button
            onClick={() => setShowPast(!showPast)}
            className="flex items-center gap-2 text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <History className="w-3.5 h-3.5" />
            Previous Targets ({pastTargets.length})
          </button>
          <AnimatePresence>
            {showPast && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2"
              >
                {pastTargets.map(t => renderTarget(t, true))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
