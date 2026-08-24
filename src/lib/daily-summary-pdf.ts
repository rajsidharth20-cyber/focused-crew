import { supabase } from '@/integrations/supabase/client';
import type { DailyObjective, Subject, WeeklyTarget, Commitment, PlannerEvent } from '@/hooks/use-planner-store';
import type { StudySession } from '@/hooks/use-study-store';
import { dayKeyFor, getEffectiveToday } from '@/lib/day-boundary';
import { buildDailyReport, fmtMin, type ReportData, type Stat } from '@/lib/daily-report-doc';

interface SummaryInput {
  username: string | null;
  subjects: Subject[];
  dailyObjectives: DailyObjective[];
  weeklyTargets: WeeklyTarget[];
  commitments: Commitment[];
  events: PlannerEvent[];
  sessions?: StudySession[];
  streak?: number;
}

const DASH = '\u2014';
const round1 = (n: number) => Math.round(n * 10) / 10;
const minutesOfDay = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
const dayLabel = (key: string) =>
  new Date(key + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export async function generateDailySummaryPDF(input: SummaryInput): Promise<void> {
  const { username, subjects, dailyObjectives, weeklyTargets, commitments, events } = input;
  const sessions = input.sessions ?? [];
  const subjectName = (id: string | null | undefined) =>
    (id && subjects.find(s => s.id === id)?.name) || 'General';

  const today = getEffectiveToday();
  const dateStr = new Date(today + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  /* -------- day keys for the trailing 7 days (today last) -------- */
  const dayKeys: string[] = [];
  {
    const base = new Date(today + 'T12:00:00');
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      dayKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
  }

  const byDay = new Map<string, StudySession[]>();
  for (const s of sessions) {
    const k = dayKeyFor(new Date(s.startedAt));
    const arr = byDay.get(k);
    if (arr) arr.push(s); else byDay.set(k, [s]);
  }
  const todaySessions = (byDay.get(today) ?? []).slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const weekSessions = dayKeys.flatMap(k => byDay.get(k) ?? []);

  const mins = (xs: StudySession[]) => xs.reduce((a, s) => a + (s.durationSeconds || 0), 0) / 60;
  const todayMin = mins(todaySessions);
  const weekMin = mins(weekSessions);

  /* -------- objectives -------- */
  const doneObjectives = dailyObjectives.filter(o => o.completed);
  const hasObjectives = dailyObjectives.length > 0;
  const pct = hasObjectives ? Math.round((doneObjectives.length / dailyObjectives.length) * 100) : null;

  /* -------- delays -------- */
  const delays = (xs: StudySession[]) => xs.map(s => s.delayMinutes).filter((d): d is number => typeof d === 'number');
  const todayDelays = delays(todaySessions);
  const weekDelays = delays(weekSessions);
  const allDelays = delays(sessions);
  const todayDelayAvg = avg(todayDelays);
  const weekDelayAvg = avg(weekDelays);
  const allDelayAvg = avg(allDelays);
  const totalDelayed = allDelays.reduce((a, b) => a + b, 0);

  /* -------- stats -------- */
  const stats: Stat[] = [
    {
      label: 'Objectives completed',
      value: hasObjectives ? `${doneObjectives.length}/${dailyObjectives.length}` : DASH,
      hint: hasObjectives ? undefined : 'No objectives set',
    },
    {
      label: 'Completion',
      value: pct == null ? DASH : `${pct}%`,
      hint: pct == null ? 'No objectives set' : undefined,
    },
    {
      label: 'Total focused time',
      value: todaySessions.length ? fmtMin(todayMin) : DASH,
      hint: todaySessions.length ? undefined : 'No data logged',
    },
    {
      label: 'Focus sessions',
      value: todaySessions.length ? String(todaySessions.length) : DASH,
      hint: todaySessions.length ? `avg ${fmtMin(todayMin / todaySessions.length)} each` : 'No data logged',
    },
    {
      label: 'Average delay',
      value: todayDelayAvg == null ? DASH : `${round1(todayDelayAvg)} min`,
      hint: todayDelayAvg == null ? 'Not tracked today' : undefined,
    },
    {
      label: 'Current streak',
      value: input.streak != null ? `${input.streak} day${input.streak === 1 ? '' : 's'}` : DASH,
    },
  ];

  /* -------- status -------- */
  let statusLabel = 'No data logged today';
  let statusHint = 'Start a focus session or set objectives to see your report fill in.';
  if (todaySessions.length || hasObjectives) {
    if (!todaySessions.length) {
      statusLabel = 'Objectives set, nothing logged';
      statusHint = `${dailyObjectives.length} objective${dailyObjectives.length === 1 ? '' : 's'} planned, but no focus session was recorded.`;
    } else if (pct != null && pct >= 80 && todayMin >= 60) {
      statusLabel = 'Strong day';
      statusHint = `${fmtMin(todayMin)} focused across ${todaySessions.length} session${todaySessions.length === 1 ? '' : 's'} and ${pct}% of objectives done.`;
    } else if (todayMin >= 30) {
      statusLabel = 'Steady day';
      statusHint = `${fmtMin(todayMin)} focused across ${todaySessions.length} session${todaySessions.length === 1 ? '' : 's'}.`;
    } else {
      statusLabel = 'Light day';
      statusHint = `Only ${fmtMin(todayMin)} of focused time was logged.`;
    }
  }

  /* -------- subject breakdown (today) -------- */
  const subjMinToday = new Map<string, number>();
  for (const s of todaySessions) {
    const k = subjectName(s.subjectId);
    subjMinToday.set(k, (subjMinToday.get(k) ?? 0) + (s.durationSeconds || 0) / 60);
  }
  const subjectRows = [...subjMinToday.entries()]
    .map(([name, minutes]) => ({ name, minutes, share: todayMin > 0 ? (minutes / todayMin) * 100 : 0 }))
    .sort((a, b) => b.minutes - a.minutes);

  /* -------- planned vs actual (per subject) -------- */
  const plannedBySubject = new Map<string, number>();
  for (const o of dailyObjectives) {
    const k = subjectName(o.subjectId);
    plannedBySubject.set(k, (plannedBySubject.get(k) ?? 0) + (o.estimatedMinutes || 0));
  }
  const pvaNames = new Set([...plannedBySubject.keys(), ...subjMinToday.keys()]);
  const plannedVsActual = [...pvaNames]
    .map(label => ({ label, plannedMin: plannedBySubject.get(label) ?? 0, actualMin: subjMinToday.get(label) ?? 0 }))
    .filter(r => r.plannedMin > 0 || r.actualMin > 0)
    .sort((a, b) => Math.max(b.plannedMin, b.actualMin) - Math.max(a.plannedMin, a.actualMin));

  /* -------- timeline -------- */
  const timeline = todaySessions
    .map(s => {
      const start = minutesOfDay(s.startedAt);
      const end = Math.max(start + Math.max(1, (s.durationSeconds || 0) / 60), start + 1);
      return { startMin: start, endMin: Math.min(1440, end), label: subjectName(s.subjectId) };
    })
    .sort((a, b) => a.startMin - b.startMin);

  /* -------- week chart -------- */
  const week = dayKeys.map(k => ({ label: k === today ? 'Today' : dayLabel(k), minutes: mins(byDay.get(k) ?? []) }));
  const activeDays = week.filter(d => d.minutes > 0);
  const weekSummary: Stat[] = [
    { label: '7-day total', value: weekSessions.length ? fmtMin(weekMin) : DASH },
    { label: 'Avg / day', value: weekSessions.length ? fmtMin(weekMin / 7) : DASH },
    { label: 'Avg / session', value: weekSessions.length ? fmtMin(weekMin / weekSessions.length) : DASH },
  ];

  /* -------- patterns -------- */
  const patterns: { label: string; value: string }[] = [];
  if (weekSessions.length) {
    const buckets = [
      { label: 'Morning (05\u201312)', from: 5, to: 12, m: 0 },
      { label: 'Afternoon (12\u201317)', from: 12, to: 17, m: 0 },
      { label: 'Evening (17\u201322)', from: 17, to: 22, m: 0 },
      { label: 'Night (22\u201305)', from: 22, to: 29, m: 0 },
    ];
    for (const s of weekSessions) {
      const h = new Date(s.startedAt).getHours();
      const hh = h < 5 ? h + 24 : h;
      const b = buckets.find(x => hh >= x.from && hh < x.to);
      if (b) b.m += (s.durationSeconds || 0) / 60;
    }
    const best = buckets.slice().sort((a, b) => b.m - a.m)[0];
    if (best.m > 0) patterns.push({ label: 'Most productive time', value: `${best.label} \u00B7 ${fmtMin(best.m)}` });

    const subjWeek = new Map<string, { m: number; days: Set<string> }>();
    for (const s of weekSessions) {
      const k = subjectName(s.subjectId);
      const e = subjWeek.get(k) ?? { m: 0, days: new Set<string>() };
      e.m += (s.durationSeconds || 0) / 60;
      e.days.add(dayKeyFor(new Date(s.startedAt)));
      subjWeek.set(k, e);
    }
    const byMinutes = [...subjWeek.entries()].sort((a, b) => b[1].m - a[1].m);
    if (byMinutes.length) patterns.push({ label: 'Most focused subject', value: `${byMinutes[0][0]} \u00B7 ${fmtMin(byMinutes[0][1].m)}` });
    const byDays = [...subjWeek.entries()].sort((a, b) => b[1].days.size - a[1].days.size);
    if (byDays.length && byDays[0][1].days.size > 1) {
      patterns.push({ label: 'Most consistent subject', value: `${byDays[0][0]} \u00B7 ${byDays[0][1].days.size} of 7 days` });
    }
    patterns.push({ label: 'Average daily focus', value: fmtMin(weekMin / 7) });
    const bestDay = week.slice().sort((a, b) => b.minutes - a.minutes)[0];
    if (bestDay.minutes > 0) patterns.push({ label: 'Best focus day', value: `${bestDay.label} \u00B7 ${fmtMin(bestDay.minutes)}` });
    patterns.push({ label: 'Days with focus logged', value: `${activeDays.length} of 7` });
  }
  if (input.streak != null) patterns.push({ label: 'Current streak', value: `${input.streak} day${input.streak === 1 ? '' : 's'}` });

  // week over week
  let wow: string | null = null;
  {
    const prevKeys: string[] = [];
    const base = new Date(today + 'T12:00:00');
    for (let i = 13; i >= 7; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      prevKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    const prevMin = prevKeys.reduce((a, k) => a + mins(byDay.get(k) ?? []), 0);
    if (prevMin > 0 && weekMin > 0) {
      const delta = Math.round(((weekMin - prevMin) / prevMin) * 100);
      wow = `${delta >= 0 ? '+' : ''}${delta}% vs previous 7 days`;
      patterns.push({ label: 'Week over week', value: wow });
    }
  }

  /* -------- session notes today -------- */
  const notes = todaySessions
    .filter(s => (s.notes ?? '').trim().length > 0)
    .map(s => ({ subject: `${subjectName(s.subjectId)} \u00B7 ${fmtMin((s.durationSeconds || 0) / 60)}`, note: (s.notes as string).trim() }));

  const objectiveNotes = dailyObjectives
    .filter(o => (o.progressNotes?.length ?? 0) > 0)
    .map(o => ({ subject: `${subjectName(o.subjectId)} \u00B7 ${o.task}`, note: o.progressNotes.slice(-2).join(' \u2014 ') }));

  /* -------- targets -------- */
  const targets: string[] = [];
  if (weekSessions.length >= 3) {
    const targetMin = Math.max(30, Math.round((weekMin / 7) * 1.15 / 5) * 5);
    targets.push(`Average ${fmtMin(targetMin)} of focused time per day.`);
    const sessionTarget = Math.max(1, Math.round(weekSessions.length / 7) + 1);
    targets.push(`Log at least ${sessionTarget} focus session${sessionTarget === 1 ? '' : 's'} on each study day.`);
    if (weekDelayAvg != null && weekDelayAvg > 5) {
      targets.push(`Bring your average start delay below ${Math.max(5, Math.floor(weekDelayAvg / 2))} minutes.`);
    } else if (activeDays.length < 6) {
      targets.push(`Add focused time on ${6 - activeDays.length} more day${6 - activeDays.length === 1 ? '' : 's'} next week.`);
    }
    const openTargets = weeklyTargets.filter(t => !t.completed);
    if (openTargets.length) targets.push(`Close ${Math.min(3, openTargets.length)} open weekly target${Math.min(3, openTargets.length) === 1 ? '' : 's'}, starting with "${openTargets[0].target}".`);
  }

  /* -------- AI review -------- */
  const facts = {
    date: today,
    objectives: {
      total: dailyObjectives.length,
      completed: doneObjectives.length,
      completionPercent: pct,
      items: dailyObjectives.map(o => ({
        task: o.task, subject: subjectName(o.subjectId), priority: o.priority,
        completed: o.completed, plannedMinutes: o.estimatedMinutes,
        notes: o.progressNotes?.slice(-2) ?? [],
      })),
    },
    focus: {
      todayMinutes: Math.round(todayMin),
      sessionCount: todaySessions.length,
      averageSessionMinutes: todaySessions.length ? Math.round(todayMin / todaySessions.length) : null,
      bySubjectToday: subjectRows.map(r => ({ subject: r.name, minutes: Math.round(r.minutes) })),
      sevenDayMinutes: Math.round(weekMin),
      sevenDayByDay: week.map(d => ({ day: d.label, minutes: Math.round(d.minutes) })),
      weekOverWeek: wow,
    },
    punctuality: {
      todayAverageDelayMinutes: todayDelayAvg == null ? null : round1(todayDelayAvg),
      sevenDayAverageDelayMinutes: weekDelayAvg == null ? null : round1(weekDelayAvg),
      allTimeAverageDelayMinutes: allDelayAvg == null ? null : round1(allDelayAvg),
    },
    streak: input.streak ?? null,
    commitments: dedupe(commitments.map(c => `${c.startTime}-${c.endTime} ${c.title}`)),
    upcomingEvents: dedupe(events.filter(e => e.eventDate).map(e => `${e.eventDate} ${e.title}`)).slice(0, 5),
    weeklyTargets: weeklyTargets.map(t => ({ target: t.target, subject: subjectName(t.subjectId), completed: t.completed })),
    sessionNotes: notes.map(n => n.note).slice(0, 6),
  };

  let ai = fallbackReview();
  try {
    const { data, error } = await supabase.functions.invoke('daily-summary', { body: { state: facts } });
    if (!error && data) {
      const parsed = normaliseAI(data);
      if (parsed) ai = parsed;
    }
  } catch (e) {
    console.warn('AI review unavailable, using data-derived review', e);
  }

  const oneThing = deriveOneThing();

  const report: ReportData = {
    name: username ? `@${username}` : 'Focused Crew member',
    dateStr,
    statusLabel,
    statusHint,
    stats,
    ai,
    plannedVsActual,
    subjects: subjectRows,
    punctuality: [
      { label: "Today's average delay", value: todayDelayAvg == null ? DASH : `${round1(todayDelayAvg)} min` },
      { label: '7-day average delay', value: weekDelayAvg == null ? DASH : `${round1(weekDelayAvg)} min` },
      { label: 'All-time average delay', value: allDelayAvg == null ? DASH : `${round1(allDelayAvg)} min` },
      { label: 'Total delayed time', value: allDelays.length ? fmtMin(totalDelayed) : DASH },
    ],
    timeline,
    week,
    weekSummary,
    patterns,
    targets,
    notes: [...notes, ...objectiveNotes],
    oneThing,
  };

  const doc = buildDailyReport(report);
  doc.save(`focused-crew-daily-report-${today}.pdf`);

  /* ---------------- helpers ---------------- */

  function fallbackReview() {
    const well: string[] = [];
    const attention: string[] = [];
    if (doneObjectives.length) well.push(`Completed ${doneObjectives.length} of ${dailyObjectives.length} objectives${pct != null ? ` (${pct}%)` : ''}.`);
    if (todaySessions.length) well.push(`Logged ${fmtMin(todayMin)} of focused time across ${todaySessions.length} session${todaySessions.length === 1 ? '' : 's'}.`);
    if (subjectRows.length) well.push(`Most time went to ${subjectRows[0].name} (${fmtMin(subjectRows[0].minutes)}).`);
    if (!hasObjectives) attention.push('No objectives were set for today, so completion cannot be measured.');
    else if (dailyObjectives.length - doneObjectives.length > 0) attention.push(`${dailyObjectives.length - doneObjectives.length} objective(s) are still open.`);
    if (!todaySessions.length) attention.push(`You had ${commitments.length} scheduled commitment(s) but logged 0 focused sessions.`);
    if (todayDelayAvg != null && todayDelayAvg > 10) attention.push(`Sessions started an average of ${round1(todayDelayAvg)} minutes late.`);
    return { well, attention, priority: derivePriority() };
  }

  function derivePriority() {
    const open = dailyObjectives.filter(o => !o.completed);
    if (open.length) {
      const o = open.slice().sort((a, b) => (b.estimatedMinutes || 0) - (a.estimatedMinutes || 0))[0];
      return `Start tomorrow with "${o.task}" (${subjectName(o.subjectId)}, ${o.estimatedMinutes || 30} min) before midday.`;
    }
    if (!todaySessions.length) return 'Book one 45-minute focus session tomorrow morning and log it in the timer.';
    return `Repeat today's best block: one ${fmtMin(Math.max(30, todayMin / Math.max(1, todaySessions.length)))} session on ${subjectRows[0]?.name ?? 'your main subject'}.`;
  }

  function deriveOneThing() {
    const open = dailyObjectives.filter(o => !o.completed);
    if (open.length) {
      const o = open.slice().sort((a, b) => (b.estimatedMinutes || 0) - (a.estimatedMinutes || 0))[0];
      const subj = subjectName(o.subjectId);
      const actual = subjMinToday.get(subj) ?? 0;
      return {
        action: `Complete one ${o.estimatedMinutes || 45}-minute ${subj} session on "${o.task}" before 11:00 AM.`,
        why: actual > 0
          ? `You logged ${fmtMin(actual)} on ${subj} today but this objective is still open.`
          : `This objective was planned for today (${o.estimatedMinutes || 45} min) and no time was logged against ${subj}.`,
      };
    }
    if (!todaySessions.length) {
      return {
        action: 'Run one 45-minute focus session tomorrow morning and log it with the timer.',
        why: hasObjectives
          ? `You set ${dailyObjectives.length} objective(s) today but recorded 0 focused sessions.`
          : 'No objectives and no sessions were logged today, so there is no data to build on.',
      };
    }
    const weakest = subjectRows[subjectRows.length - 1];
    return {
      action: `Add one ${fmtMin(Math.max(30, weekMin / 7 / 2))} session on ${weakest?.name ?? 'your main subject'} tomorrow.`,
      why: `${weakest?.name ?? 'It'} received only ${fmtMin(weakest?.minutes ?? 0)} of your ${fmtMin(todayMin)} focused time today.`,
    };
  }
}

function dedupe(xs: string[]) {
  return [...new Set(xs)];
}

function normaliseAI(data: any): { well: string[]; attention: string[]; priority: string } | null {
  const clean = (v: unknown) =>
    Array.isArray(v)
      ? v.map(x => String(x).replace(/^[-•*\s]+/, '').trim()).filter(Boolean)
      : typeof v === 'string'
        ? v.split('\n').map(l => l.replace(/^[-•*\s]+/, '').trim()).filter(Boolean)
        : [];

  const review = data.review ?? data;
  const well = clean(review.well ?? review.wentWell ?? review.what_went_well);
  const attention = clean(review.attention ?? review.needsAttention ?? review.needs_attention);
  const priority = String(review.priority ?? review.tomorrow ?? review.tomorrows_priority ?? '').trim();
  if (!well.length && !attention.length && !priority) return null;
  return { well: well.slice(0, 4), attention: attention.slice(0, 3), priority: priority || '' };
}
