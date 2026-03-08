import { useState } from 'react';
import { Plus, X, Clock, GraduationCap, MapPin, Users, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Commitment } from '@/hooks/use-planner-store';

interface CommitmentsProps {
  commitments: Commitment[];
  onAdd: (title: string, startTime: string, endTime: string, type: Commitment['type']) => void;
  onRemove: (id: string) => void;
}

const typeIcons = {
  class: GraduationCap,
  visit: MapPin,
  meeting: Users,
  other: MoreHorizontal,
};

const typeColors: Record<string, string> = {
  class: 'text-blue-400',
  visit: 'text-green-400',
  meeting: 'text-purple-400',
  other: 'text-muted-foreground',
};

export function Commitments({ commitments, onAdd, onRemove }: CommitmentsProps) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [type, setType] = useState<Commitment['type']>('class');

  const handleAdd = () => {
    if (title.trim() && startTime && endTime) {
      onAdd(title.trim(), startTime, endTime, type);
      setTitle('');
      setStartTime('');
      setEndTime('');
    }
  };

  const sorted = [...commitments].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-primary" />
        <h3 className="font-display text-sm font-semibold tracking-wide uppercase text-primary">
          Commitments
        </h3>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          value={type}
          onChange={e => setType(e.target.value as Commitment['type'])}
          className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="class">Class</option>
          <option value="visit">Visit</option>
          <option value="meeting">Meeting</option>
          <option value="other">Other</option>
        </select>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="What..."
          className="flex-1 min-w-[120px] bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <input
          value={startTime}
          onChange={e => setStartTime(e.target.value)}
          type="time"
          className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <input
          value={endTime}
          onChange={e => setEndTime(e.target.value)}
          type="time"
          className="bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button onClick={handleAdd} className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {sorted.map(c => {
            const Icon = typeIcons[c.type];
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-3 bg-secondary/30 rounded-md px-3 py-2.5"
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${typeColors[c.type]}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground">{c.title}</span>
                </div>
                <span className="text-xs text-muted-foreground font-display whitespace-nowrap">
                  {c.startTime} – {c.endTime}
                </span>
                <button onClick={() => onRemove(c.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {commitments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No commitments today.</p>
        )}
      </div>
    </div>
  );
}
