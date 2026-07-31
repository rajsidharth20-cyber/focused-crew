import { useState, useMemo } from 'react';
import { Plus, X, Clock, GraduationCap, MapPin, Users, MoreHorizontal, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Commitment } from '@/hooks/use-planner-store';
import { useTerms } from '@/lib/terms';
import { useNow, toMinutes } from '@/hooks/use-now';
import { ScheduleFilterChips } from '@/components/ScheduleFilterChips';
import { matchesRange, type RangeKey } from '@/lib/schedule-filter';


interface CommitmentsProps {
  commitments: Commitment[];
  onAdd: (title: string, startTime: string, endTime: string, type: Commitment['type'], recurringDays?: number[]) => void;
  onRemove: (id: string) => void;
}

const typeIcons = {
  class: GraduationCap,
  visit: MapPin,
  meeting: Users,
  other: MoreHorizontal,
};

const typeColors: Record<string, string> = {
  class: 'text-primary',
  visit: 'text-success',
  meeting: 'text-accent',
  other: 'text-muted-foreground',
};

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatRecurring(days: number[]) {
  const sorted = [...days].sort();
  if (sorted.length === 7) return 'Every day';
  if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) return 'Weekdays';
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) return 'Weekends';
  return sorted.map(d => DAY_NAMES[d]).join(', ');
}

export function Commitments({ commitments, onAdd, onRemove }: CommitmentsProps) {
  const t = useTerms();
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [type, setType] = useState<Commitment['type']>('class');
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const toggleDay = (d: number) => {
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleAdd = () => {
    if (title.trim() && startTime && endTime) {
      if (isRecurring && selectedDays.length === 0) return;
      onAdd(title.trim(), startTime, endTime, type, isRecurring ? selectedDays : undefined);
      setTitle('');
      setStartTime('');
      setEndTime('');
      setSelectedDays([]);
      setIsRecurring(false);
    }
  };

  const [range, setRange] = useState<RangeKey>('today');
  const now = useNow(30_000);

  const visible = useMemo(
    () => commitments.filter(c => matchesRange({ recurringDays: c.recurringDays }, range, now)),
    [commitments, range, now]
  );

  const sorted = useMemo(
    () => [...visible].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [visible]
  );

  const nowMin = now.getHours() * 60 + now.getMinutes();

  const { currentId, nextId } = useMemo(() => {
    let currentId: string | null = null;
    let nextId: string | null = null;
    let nextStart = Infinity;
    for (const c of sorted) {
      const s = toMinutes(c.startTime);
      const e = toMinutes(c.endTime);
      if (s == null) continue;
      if (e != null && nowMin >= s && nowMin < e) currentId = c.id;
      else if (s > nowMin && s < nextStart) { nextStart = s; nextId = c.id; }
    }
    return { currentId, nextId };
  }, [sorted, nowMin]);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-primary" />
        <h3 className="font-display text-sm font-semibold tracking-wide uppercase text-primary">
          {t.commitments}
        </h3>
      </div>

      <ScheduleFilterChips value={range} onChange={setRange} className="mb-3" />



      <div className="flex gap-2 mb-3 flex-wrap">
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
          placeholder="Where to..."
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

      <div className="mb-4 space-y-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={e => { setIsRecurring(e.target.checked); if (!e.target.checked) setSelectedDays([]); }}
            className="accent-primary"
          />
          <Repeat className="w-3 h-3" />
          Repeats on specific days
        </label>
        {isRecurring && (
          <div className="flex gap-1 flex-wrap">
            {DAY_LABELS.map((lbl, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${
                  selectedDays.includes(i)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                }`}
                title={DAY_NAMES[i]}
              >
                {lbl}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {sorted.map(c => {
            const Icon = typeIcons[c.type];
            const isCurrent = c.id === currentId;
            const isNext = c.id === nextId;
            const stateClass = isCurrent
              ? 'bg-primary/15 ring-1 ring-primary/50 shadow-[0_0_20px_-8px_hsl(var(--primary)/0.6)]'
              : isNext
                ? 'bg-accent/10 ring-1 ring-accent/40'
                : 'bg-secondary/30';
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${stateClass}`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${typeColors[c.type]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm text-foreground">{c.title}</span>
                    {isCurrent && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-primary bg-primary/15 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Now
                      </span>
                    )}
                    {isNext && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-accent bg-accent/15 px-1.5 py-0.5 rounded-full">
                        Next
                      </span>
                    )}
                  </div>
                  {c.recurringDays && c.recurringDays.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-primary/80 mt-0.5">
                      <Repeat className="w-2.5 h-2.5" />
                      {formatRecurring(c.recurringDays)}
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-display whitespace-nowrap tabular-nums">
                  {c.startTime} – {c.endTime}
                </span>
                <button onClick={() => onRemove(c.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {commitments.length === 0 ? t.commitmentsEmpty : 'Nothing in this range.'}
          </p>
        )}
      </div>
    </div>
  );
}

