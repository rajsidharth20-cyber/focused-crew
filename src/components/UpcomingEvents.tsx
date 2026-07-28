import { useState, useMemo } from 'react';
import { Plus, X, CalendarDays, Clock, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import type { PlannerEvent } from '@/hooks/use-planner-store';
import { useNow, toMinutes } from '@/hooks/use-now';

interface UpcomingEventsProps {
  events: PlannerEvent[];
  onAdd: (title: string, eventDate: string | null, startTime?: string, endTime?: string, description?: string, recurringDays?: number[]) => void;
  onRemove: (id: string) => void;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatRecurring(days: number[]) {
  const sorted = [...days].sort();
  if (sorted.length === 7) return 'Every day';
  if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) return 'Weekdays';
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) return 'Weekends';
  return sorted.map(d => DAY_NAMES[d]).join(', ');
}

function formatEventDate(dateStr: string) {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE, MMM d');
}

export function UpcomingEvents({ events, onAdd, onRemove }: UpcomingEventsProps) {
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const toggleDay = (d: number) => {
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleAdd = () => {
    if (!title.trim()) return;
    if (isRecurring) {
      if (selectedDays.length === 0) return;
      onAdd(title.trim(), null, startTime || undefined, endTime || undefined, description.trim() || undefined, selectedDays);
    } else {
      if (!eventDate) return;
      onAdd(title.trim(), eventDate, startTime || undefined, endTime || undefined, description.trim() || undefined);
    }
    setTitle(''); setEventDate(''); setStartTime(''); setEndTime(''); setDescription('');
    setSelectedDays([]); setIsRecurring(false); setShowForm(false);
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h3 className="font-display text-sm font-semibold tracking-wide uppercase text-primary">
            Upcoming Events
          </h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Event
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="space-y-2 bg-secondary/30 rounded-md p-3">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Event title"
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={e => { setIsRecurring(e.target.checked); if (!e.target.checked) setSelectedDays([]); else setEventDate(''); }}
                  className="accent-primary"
                />
                <Repeat className="w-3 h-3" />
                Repeats on specific days
              </label>
              {isRecurring ? (
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
              ) : (
                <input
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  type="date"
                  className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              )}
              <div className="flex gap-2">
                <input
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  type="time"
                  className="flex-1 bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <input
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  type="time"
                  className="flex-1 bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <button
                onClick={handleAdd}
                className="w-full bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Save Event
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <AnimatePresence>
          {events.map(event => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-start gap-3 bg-secondary/30 rounded-md px-3 py-2.5"
            >
              <CalendarDays className="w-4 h-4 flex-shrink-0 text-primary mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-foreground font-medium">{event.title}</span>
                {event.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                {event.recurringDays && event.recurringDays.length > 0 ? (
                  <span className="text-xs font-display text-primary flex items-center gap-1 justify-end">
                    <Repeat className="w-3 h-3" />
                    {formatRecurring(event.recurringDays)}
                  </span>
                ) : event.eventDate ? (
                  <span className="text-xs font-display text-primary">{formatEventDate(event.eventDate)}</span>
                ) : null}
                {(event.startTime || event.endTime) && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 justify-end">
                    <Clock className="w-3 h-3" />
                    {event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}
                  </div>
                )}
              </div>
              <button onClick={() => onRemove(event.id)} className="text-muted-foreground hover:text-destructive transition-colors mt-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {events.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No upcoming events.</p>
        )}
      </div>
    </div>
  );
}
