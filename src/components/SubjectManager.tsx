import { useState } from 'react';
import { Plus, X, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Subject } from '@/hooks/use-planner-store';
import { useTerms } from '@/lib/terms';

interface SubjectManagerProps {
  subjects: Subject[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}

export function SubjectManager({ subjects, onAdd, onRemove }: SubjectManagerProps) {
  const t = useTerms();
  const [input, setInput] = useState('');

  const handleAdd = () => {
    if (input.trim()) {
      onAdd(input.trim());
      setInput('');
    }
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Navigation className="w-4 h-4 text-primary" />
        <h3 className="font-display text-sm font-semibold tracking-wide uppercase text-primary">
          {t.subjects}
        </h3>
      </div>
      <div className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={t.subjectPlaceholder}
          className="flex-1 bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button
          onClick={handleAdd}
          className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence>
          {subjects.map(s => (
            <motion.span
              key={s.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="inline-flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-md text-sm text-secondary-foreground"
            >
              {s.name}
              <button onClick={() => onRemove(s.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
