import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, TrendingUp, TrendingDown, Calendar, Timer, Target, BookOpen, AlarmClock } from 'lucide-react';
import type { StudySession, StudyTag } from '@/hooks/use-study-store';
import type { Subject, DailyObjective } from '@/hooks/use-planner-store';

interface Props {
  sessions: StudySession[];
  tags: StudyTag[];
  subjects: Subject[];
  objectives: DailyObjective[];
  pastObjectives: DailyObjective[];
}

const fmtHours = (sec: number) => {
  const h = sec / 3600;
  if (h >= 10) return `${h.toFixed(0)}h`;
  if (h >= 1) return `${h.toFixed(1)}h`;
  return `${Math.round(sec / 60)}m`;
};

const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

const startOfWeek = (d: Date) => {
  const nd = new Date(d);
  const day = (nd.getDay() + 6) % 7; // Monday = 0
  nd.setDate(nd.getDate() - day);
  nd.setHours(0, 0, 0, 0);
  return nd;
};

export function StudyStats({ sessions, tags, subjects, objectives, pastObjectives }: Props) {
  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const secondsIntoDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    const yStart = new Date(now); yStart.setDate(yStart.getDate() - 1); yStart.setHours(0, 0, 0, 0);
    const yCutoff = new Date(yStart.getTime() + secondsIntoDay * 1000);

    const thisWeekStart = startOfWeek(now);
    const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    let today = 0, yesterdaySoFar = 0, thisWeek = 0, lastWeek = 0, thisMonth = 0, lastMonth = 0, total = 0;
    const perDay = new Map<string, number>();
    const perSubject = new Map<string, number>();
    const perTag = new Map<string, number>();
    const perType = { pomodoro: 0, stopwatch: 0, manual: 0 };
    const perTopic = new Map<string, number>();

    for (const s of sessions) {
      const start = new Date(s.startedAt);
      const dur = s.durationSeconds;
      total += dur;
      const dk = dayKey(s.startedAt);
      perDay.set(dk, (perDay.get(dk) ?? 0) + dur);
      if (dk === todayStr) today += dur;
      if (start >= yStart && start <= yCutoff) yesterdaySoFar += dur;
      if (start >= thisWeekStart) thisWeek += dur;
      else if (start >= lastWeekStart) lastWeek += dur;
      if (start >= thisMonthStart) thisMonth += dur;
      else if (start >= lastMonthStart && start < lastMonthEnd) lastMonth += dur;
      if (s.subjectId) perSubject.set(s.subjectId, (perSubject.get(s.subjectId) ?? 0) + dur);
      if (s.tagId) perTag.set(s.tagId, (perTag.get(s.tagId) ?? 0) + dur);
      perType[s.type] = (perType[s.type] ?? 0) + dur;
      const topic = (s.topic ?? '').trim();
      if (topic) perTopic.set(topic, (perTopic.get(topic) ?? 0) + dur);
    }

    const daysWithStudy = perDay.size;
    const avgDaily = daysWithStudy > 0 ? total / daysWithStudy : 0;

    let longestDay = { day: '—', sec: 0 };
    perDay.forEach((sec, day) => {
      if (sec > longestDay.sec) longestDay = { day, sec };
    });

    const plannedTodaySec = objectives.reduce((sum, o) => sum + (o.estimatedMinutes || 0) * 60, 0);

    return {
      today, yesterdaySoFar, thisWeek, lastWeek, thisMonth, lastMonth, total,
      avgDaily, longestDay, perSubject, perTag, perType, perTopic,
      plannedTodaySec,
    };
  }, [sessions, objectives, pastObjectives]);

  const subjectRows = useMemo(() => {
    const arr = Array.from(stats.perSubject.entries()).map(([id, sec]) => ({
      id, name: subjects.find(s => s.id === id)?.name ?? 'Unknown', sec,
    })).sort((a, b) => b.sec - a.sec);
    return arr;
  }, [stats.perSubject, subjects]);

  const tagRows = useMemo(() => {
    return Array.from(stats.perTag.entries()).map(([id, sec]) => {
      const t = tags.find(x => x.id === id);
      return { id, name: t?.name ?? 'Unknown', color: t?.color ?? '#888', sec };
    }).sort((a, b) => b.sec - a.sec);
  }, [stats.perTag, tags]);


  const weekDelta = stats.thisWeek - stats.lastWeek;
  const monthDelta = stats.thisMonth - stats.lastMonth;
  const plannedPct = stats.plannedTodaySec > 0 ? Math.min(100, (stats.today / stats.plannedTodaySec) * 100) : 0;
  const maxBar = Math.max(1, stats.thisWeek, stats.lastWeek, stats.thisMonth, stats.lastMonth);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <BigStat icon={Flame} tint="primary" label="Today" value={fmtHours(stats.today)} />
        <BigStat icon={Calendar} tint="accent" label="Yesterday (so far)" value={fmtHours(stats.yesterdaySoFar)} sub="same time" />
        <BigStat icon={Calendar} tint="primary" label="Daily avg" value={fmtHours(stats.avgDaily)} />
        <BigStat icon={Timer} tint="destructive" label="Longest day" value={fmtHours(stats.longestDay.sec)} sub={stats.longestDay.day !== '—' ? stats.longestDay.day : undefined} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ComparisonCard
          title="This week vs last week"
          current={stats.thisWeek}
          previous={stats.lastWeek}
          max={maxBar}
          delta={weekDelta}
        />
        <ComparisonCard
          title="This month vs last month"
          current={stats.thisMonth}
          previous={stats.lastMonth}
          max={maxBar}
          delta={monthDelta}
        />
      </div>

      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="font-display text-sm font-bold uppercase tracking-widest">Planned vs actual (today)</h3>
        </div>
        {stats.plannedTodaySec === 0 ? (
          <p className="text-xs text-muted-foreground">No planned time — add today's objectives with estimated minutes to compare.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Actual: <span className="text-foreground font-semibold">{fmtHours(stats.today)}</span></span>
              <span>Planned: <span className="text-foreground font-semibold">{fmtHours(stats.plannedTodaySec)}</span></span>
            </div>
            <div className="h-3 bg-secondary/60 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${plannedPct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-primary"
              />
            </div>
            <div className="text-xs text-muted-foreground">{plannedPct.toFixed(0)}% of planned time completed</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BreakdownCard title="Subject-wise hours" icon={BookOpen} rows={subjectRows.map(r => ({ label: r.name, sec: r.sec }))} />
        <BreakdownCard title="Tag-wise hours" icon={Flame} rows={tagRows.map(r => ({ label: r.name, sec: r.sec, color: r.color }))} />
      </div>
    </div>
  );
}

function BigStat({ icon: Icon, tint, label, value, sub }: { icon: any; tint: 'primary' | 'accent' | 'destructive'; label: string; value: string; sub?: string }) {
  const tintClass = tint === 'primary' ? 'text-primary bg-primary/10 border-primary/20'
    : tint === 'accent' ? 'text-accent bg-accent/10 border-accent/20'
    : 'text-destructive bg-destructive/10 border-destructive/20';
  return (
    <div className={`rounded-2xl border p-4 ${tintClass}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <div className="text-[10px] uppercase tracking-widest font-display opacity-80">{label}</div>
      </div>
      <div className="text-2xl font-bold tabular-nums text-foreground">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</div>}
    </div>
  );
}

function ComparisonCard({ title, current, previous, max, delta }: { title: string; current: number; previous: number; max: number; delta: number }) {
  const up = delta >= 0;
  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest">{title}</h3>
        <div className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? 'text-primary' : 'text-destructive'}`}>
          {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {fmtHours(Math.abs(delta))}
        </div>
      </div>
      {[{ label: 'Current', v: current, tint: 'bg-gradient-primary' }, { label: 'Previous', v: previous, tint: 'bg-secondary' }].map(r => (
        <div key={r.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="tabular-nums font-semibold">{fmtHours(r.v)}</span>
          </div>
          <div className="h-2 bg-secondary/60 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(r.v / max) * 100}%` }} transition={{ duration: 0.7 }} className={`h-full ${r.tint}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

function BreakdownCard({ title, icon: Icon, rows }: { title: string; icon: any; rows: { label: string; sec: number; color?: string }[] }) {
  const max = Math.max(1, ...rows.map(r => r.sec));
  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="font-display text-sm font-bold uppercase tracking-widest">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 truncate">
                  {r.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />}
                  <span className="truncate">{r.label}</span>
                </span>
                <span className="tabular-nums font-semibold shrink-0">{fmtHours(r.sec)}</span>
              </div>
              <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(r.sec / max) * 100}%` }} transition={{ duration: 0.6 }} className="h-full" style={{ backgroundColor: r.color ?? 'hsl(var(--primary))' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
