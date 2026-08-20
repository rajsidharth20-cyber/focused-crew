import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, MapPin, Calendar as CalendarIcon, Target } from 'lucide-react';
import { useNow } from '@/hooks/use-now';
import type { Commitment, DailyObjective, PlannerEvent } from '@/hooks/use-planner-store';
import { EmptyState } from '@/components/EmptyState';
import { matchesRange } from '@/lib/schedule-filter';

type Item = {
  id: string;
  kind: 'commitment' | 'event' | 'objective';
  title: string;
  start: number; // minutes from 00:00
  end: number;
  meta?: string;
};

function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
}
function fmt(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, '0')} ${period}`;
}

interface Props {
  commitments: Commitment[];
  events: PlannerEvent[];
  objectives: DailyObjective[];
}

const START_HOUR = 6;
const END_HOUR = 24;
const HOUR_H = 56; // px per hour

export function TodayTimeline({ commitments, events, objectives }: Props) {
  const now = useNow(30_000);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    for (const c of commitments) {
      if (c.recurringDays && c.recurringDays.length > 0 && !c.recurringDays.includes(new Date().getDay())) continue;
      const s = toMinutes(c.startTime);
      const e = toMinutes(c.endTime);
      if (s == null || e == null) continue;
      out.push({ id: `c-${c.id}`, kind: 'commitment', title: c.title, start: s, end: Math.max(e, s + 15), meta: c.type });
    }
    for (const ev of events) {
      // Only show items that actually land on today (dated or recurring on this weekday).
      if (!matchesRange({ eventDate: ev.eventDate, recurringDays: ev.recurringDays }, 'today')) continue;
      const s = toMinutes(ev.startTime);
      if (s == null) continue;
      const e = toMinutes(ev.endTime) ?? s + 30;
      out.push({ id: `e-${ev.id}`, kind: 'event', title: ev.title, start: s, end: Math.max(e, s + 15), meta: ev.description || undefined });
    }
    for (const o of objectives) {
      if (o.completed || !o.deadline) continue;
      const d = new Date(o.deadline);
      if (Number.isNaN(d.getTime())) continue;
      const s = d.getHours() * 60 + d.getMinutes();
      out.push({ id: `o-${o.id}`, kind: 'objective', title: o.task, start: s, end: s + 30, meta: `Deadline ${fmt(s)}` });
    }
    return out.sort((a, b) => a.start - b.start);
  }, [commitments, events, objectives]);

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) arr.push(h);
    return arr;
  }, []);

  const totalMin = (END_HOUR - START_HOUR) * 60;
  const y = (min: number) => Math.max(0, Math.min(totalMin, min - START_HOUR * 60)) * (HOUR_H / 60);

  const nowInRange = nowMin >= START_HOUR * 60 && nowMin < END_HOUR * 60;

  if (items.length === 0) {
    return (
      <div className="glass-card p-4">
        <EmptyState
          icon={CalendarIcon}
          title="Nothing on the schedule"
          hint="Add commitments, events, or task deadlines to see them here."
        />
      </div>
    );
  }


  return (
    <div className="glass-card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Today's timeline</span>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>

      <div className="relative" style={{ height: totalMin * (HOUR_H / 60) }}>
        {/* Hour grid */}
        {hours.map((h, i) => (
          <div key={h} className="absolute inset-x-0 flex items-start gap-2" style={{ top: i * HOUR_H }}>
            <div className="w-12 text-[10px] uppercase tracking-wider text-muted-foreground/80 font-display pt-0.5">
              {((h + 11) % 12) + 1} {h >= 12 ? 'PM' : 'AM'}
            </div>
            <div className="flex-1 border-t border-border/40" />
          </div>
        ))}

        {/* Now line */}
        {nowInRange && (
          <div className="absolute left-12 right-0 z-20 pointer-events-none" style={{ top: y(nowMin) }}>
            <div className="relative">
              <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-primary shadow-md shadow-primary/50" />
              <div className="h-[2px] bg-primary/70" />
            </div>
          </div>
        )}

        {/* Items */}
        <div className="absolute left-14 right-1 top-0 bottom-0">
          {items.map((it) => {
            const top = y(it.start);
            const height = Math.max(28, y(it.end) - y(it.start));
            const isNow = nowMin >= it.start && nowMin < it.end;
            const isPast = nowMin >= it.end;
            const tint =
              it.kind === 'event'
                ? 'bg-accent/15 border-accent/40 text-accent-foreground'
                : it.kind === 'objective'
                ? 'bg-destructive/10 border-destructive/40'
                : 'bg-primary/10 border-primary/40';
            const Icon = it.kind === 'event' ? CalendarIcon : it.kind === 'objective' ? Target : MapPin;
            return (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: isPast ? 0.55 : 1, x: 0 }}
                className={`absolute left-0 right-0 rounded-xl border px-2.5 py-1.5 backdrop-blur-sm ${tint} ${
                  isNow ? 'ring-2 ring-primary/60 shadow-md shadow-primary/20' : ''
                }`}
                style={{ top, height }}
              >
                <div className="flex items-start gap-2 h-full">
                  <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-80" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold leading-tight truncate">{it.title}</div>
                    <div className="text-[10px] opacity-70 tabular-nums truncate">
                      {fmt(it.start)}
                      {it.end - it.start > 15 && ` – ${fmt(it.end)}`}
                      {isNow && ' · Now'}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
