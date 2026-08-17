import { jsPDF } from 'jspdf';
import type { StudySession, StudyTag } from '@/hooks/use-study-store';
import type { Subject, DailyObjective } from '@/hooks/use-planner-store';

interface ReportInput {
  username: string | null;
  sessions: StudySession[];
  tags: StudyTag[];
  subjects: Subject[];
  dailyObjectives: DailyObjective[];
  pastObjectives: DailyObjective[];
}

// --------- date helpers ---------
const startOfDay = (d: Date) => { const n = new Date(d); n.setHours(0, 0, 0, 0); return n; };
const startOfWeekMon = (d: Date) => { const n = startOfDay(d); const day = (n.getDay() + 6) % 7; n.setDate(n.getDate() - day); return n; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const fmtHM = (sec: number) => {
  const h = Math.floor(sec / 3600); const m = Math.round((sec % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};
const fmtHours = (sec: number) => {
  const h = sec / 3600;
  if (h >= 10) return `${h.toFixed(0)}h`;
  if (h >= 1) return `${h.toFixed(1)}h`;
  return `${Math.round(sec / 60)}m`;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// --------- aggregation ---------
function aggregate(input: ReportInput) {
  const now = new Date();
  const thisWeekStart = startOfWeekMon(now);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const nextWeekStart = addDays(thisWeekStart, 7);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let thisWeek = 0, lastWeek = 0, thisMonth = 0, lastMonth = 0, lifetime = 0;
  const perDayThisWeek: number[] = Array(7).fill(0); // Mon..Sun
  const perDayAll = new Map<string, number>();
  const perSubject = new Map<string, number>();
  const perTag = new Map<string, number>();
  const perType: Record<string, number> = { pomodoro: 0, stopwatch: 0, manual: 0 };
  const perTopic = new Map<string, number>();

  for (const s of input.sessions) {
    const start = new Date(s.startedAt);
    const dur = s.durationSeconds;
    lifetime += dur;

    if (start >= thisWeekStart && start < nextWeekStart) {
      thisWeek += dur;
      const dayIdx = Math.floor((startOfDay(start).getTime() - thisWeekStart.getTime()) / 86400000);
      if (dayIdx >= 0 && dayIdx < 7) perDayThisWeek[dayIdx] += dur;

      if (s.subjectId) perSubject.set(s.subjectId, (perSubject.get(s.subjectId) ?? 0) + dur);
      if (s.tagId) perTag.set(s.tagId, (perTag.get(s.tagId) ?? 0) + dur);
      perType[s.type] = (perType[s.type] ?? 0) + dur;
      const topic = (s.topic ?? '').trim();
      if (topic) perTopic.set(topic, (perTopic.get(topic) ?? 0) + dur);
    } else if (start >= lastWeekStart && start < thisWeekStart) {
      lastWeek += dur;
    }

    if (start >= thisMonthStart) thisMonth += dur;
    else if (start >= lastMonthStart && start < thisMonthStart) lastMonth += dur;

    const dk = isoDay(start);
    perDayAll.set(dk, (perDayAll.get(dk) ?? 0) + dur);
  }

  const activeDaysThisWeek = perDayThisWeek.filter(v => v > 0).length;
  const dailyAvgThisWeek = activeDaysThisWeek > 0 ? thisWeek / activeDaysThisWeek : 0;
  let longestDay = { idx: -1, sec: 0 };
  perDayThisWeek.forEach((sec, idx) => { if (sec > longestDay.sec) longestDay = { idx, sec }; });

  // Planned time for the week = sum of estimatedMinutes across objectives whose date falls in this week
  const inWeek = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d >= thisWeekStart && d < nextWeekStart;
  };
  const weekObjectives = [...input.dailyObjectives, ...input.pastObjectives].filter(o => inWeek(o.date));
  const plannedSec = weekObjectives.reduce((s, o) => s + (o.estimatedMinutes || 0) * 60, 0);

  return {
    thisWeekStart, thisWeek, lastWeek, thisMonth, lastMonth, lifetime,
    perDayThisWeek, perSubject, perTag, perType, perTopic,
    activeDaysThisWeek, dailyAvgThisWeek, longestDay,
    plannedSec,
  };
}

// --------- PDF ---------
export async function generateWeeklyReportPDF(input: ReportInput): Promise<void> {
  const { username, sessions, tags, subjects } = input;
  const subjectName = (id: string) => subjects.find(s => s.id === id)?.name ?? 'Unknown';
  const tagInfo = (id: string) => tags.find(t => t.id === id);

  const stats = aggregate(input);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  let y = margin;

  const weekEnd = addDays(stats.thisWeekStart, 6);
  const rangeStr = `${stats.thisWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const generatedStr = new Date().toLocaleString();

  const ensureRoom = (needed: number) => {
    if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
  };
  const text = (s: string, x: number, yy: number, opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size ?? 10);
    doc.setTextColor(...(opts.color ?? [30, 30, 30]));
    doc.text(s, x, yy);
  };
  const sectionHeader = (label: string) => {
    ensureRoom(38);
    y += 8;
    doc.setDrawColor(220);
    doc.line(margin, y, margin + contentW, y);
    y += 18;
    text(label.toUpperCase(), margin, y, { size: 12, bold: true, color: [60, 90, 200] });
    y += 16;
  };
  const bar = (x: number, yy: number, w: number, h: number, pct: number, fill: [number, number, number], bg: [number, number, number] = [230, 234, 244]) => {
    doc.setFillColor(...bg);
    doc.roundedRect(x, yy, w, h, h / 2, h / 2, 'F');
    const filledW = Math.max(0, Math.min(1, pct)) * w;
    if (filledW > 0.5) {
      doc.setFillColor(...fill);
      doc.roundedRect(x, yy, filledW, h, h / 2, h / 2, 'F');
    }
  };

  // ------ Header band ------
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 96, 'F');
  text('Focused Crew — Weekly Study Report', margin, 46, { size: 20, bold: true, color: [255, 255, 255] });
  text(`${username ? username + '  ·  ' : ''}${rangeStr}`, margin, 70, { size: 11, color: [200, 210, 230] });
  y = 124;

  // ------ Headline stat block ------
  doc.setFillColor(245, 247, 252);
  doc.roundedRect(margin, y, contentW, 88, 10, 10, 'F');
  const cellW = contentW / 4;
  const stat = (i: number, label: string, value: string, sub?: string) => {
    const x = margin + i * cellW + 16;
    text(value, x, y + 40, { size: 20, bold: true });
    text(label.toUpperCase(), x, y + 58, { size: 8, color: [110, 120, 140] });
    if (sub) text(sub, x, y + 72, { size: 8, color: [140, 150, 170] });
  };
  stat(0, 'This week', fmtHM(stats.thisWeek));
  stat(1, 'Daily average', fmtHM(stats.dailyAvgThisWeek), `${stats.activeDaysThisWeek}/7 active days`);
  stat(2, 'Longest day', fmtHM(stats.longestDay.sec), stats.longestDay.idx >= 0 ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][stats.longestDay.idx] : '—');
  stat(3, 'Lifetime', fmtHM(stats.lifetime));
  y += 108;

  // ------ Comparisons ------
  sectionHeader('Comparisons');
  const compare = (label: string, current: number, previous: number) => {
    ensureRoom(56);
    const max = Math.max(1, current, previous);
    text(label, margin, y, { size: 11, bold: true });
    const delta = current - previous;
    const arrow = delta >= 0 ? '▲' : '▼';
    const deltaColor: [number, number, number] = delta >= 0 ? [30, 130, 90] : [190, 60, 60];
    text(`${arrow} ${fmtHM(Math.abs(delta))}`, margin + contentW - 80, y, { size: 10, bold: true, color: deltaColor });
    y += 12;
    text(`Current: ${fmtHM(current)}`, margin, y + 8, { size: 9, color: [90, 90, 90] });
    bar(margin + 120, y, contentW - 120, 8, current / max, [60, 90, 200]);
    y += 16;
    text(`Previous: ${fmtHM(previous)}`, margin, y + 8, { size: 9, color: [90, 90, 90] });
    bar(margin + 120, y, contentW - 120, 8, previous / max, [140, 155, 200]);
    y += 22;
  };
  compare('This week vs last week', stats.thisWeek, stats.lastWeek);
  compare('This month vs last month', stats.thisMonth, stats.lastMonth);

  // ------ Daily breakdown ------
  sectionHeader('Daily breakdown (this week)');
  ensureRoom(180);
  const chartH = 130;
  const chartX = margin;
  const chartY = y;
  const chartW = contentW;
  const maxDay = Math.max(1, ...stats.perDayThisWeek);
  const barGap = 14;
  const barW = (chartW - barGap * 8) / 7;
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const todayIdx = (new Date().getDay() + 6) % 7;

  // baseline
  doc.setDrawColor(220);
  doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);

  stats.perDayThisWeek.forEach((sec, i) => {
    const h = (sec / maxDay) * (chartH - 20);
    const x = chartX + barGap + i * (barW + barGap);
    const barTop = chartY + chartH - h;
    const isToday = i === todayIdx;
    doc.setFillColor(...(isToday ? [60, 90, 200] as [number, number, number] : [180, 195, 235] as [number, number, number]));
    doc.roundedRect(x, barTop, barW, h, 3, 3, 'F');
    text(fmtHM(sec), x + barW / 2 - 15, barTop - 4, { size: 8, color: [90, 90, 90] });
    text(labels[i], x + barW / 2 - 9, chartY + chartH + 14, { size: 9, bold: isToday, color: isToday ? [60, 90, 200] : [90, 90, 90] });
  });
  y = chartY + chartH + 32;

  // ------ Planned vs actual (week) ------
  sectionHeader('Planned vs actual (this week)');
  if (stats.plannedSec === 0) {
    text('No planned minutes on objectives this week.', margin, y, { size: 10, color: [120, 120, 120] });
    y += 20;
  } else {
    const pct = stats.thisWeek / stats.plannedSec;
    text(`Actual: ${fmtHM(stats.thisWeek)}`, margin, y, { size: 10 });
    text(`Planned: ${fmtHM(stats.plannedSec)}`, margin + contentW - 130, y, { size: 10 });
    y += 8;
    bar(margin, y, contentW, 10, pct, [60, 90, 200]);
    y += 18;
    const note = pct >= 1.05 ? 'Ahead of plan' : pct >= 0.9 ? 'On track' : 'Behind plan';
    text(`${Math.round(pct * 100)}% of planned time completed  ·  ${note}`, margin, y, { size: 10, color: [90, 90, 90] });
    y += 18;
  }

  // ------ Time per study type ------
  sectionHeader('Time per study type (this week)');
  const totalType = Math.max(1, stats.perType.pomodoro + stats.perType.stopwatch + stats.perType.manual);
  (['pomodoro', 'stopwatch', 'manual'] as const).forEach(k => {
    const sec = stats.perType[k];
    ensureRoom(26);
    text(k.charAt(0).toUpperCase() + k.slice(1), margin, y, { size: 10 });
    text(fmtHM(sec), margin + contentW - 60, y, { size: 10, bold: true });
    y += 6;
    bar(margin, y, contentW, 8, sec / totalType, [60, 90, 200]);
    y += 18;
  });

  // ------ Breakdown tables ------
  const breakdown = (title: string, rows: { label: string; sec: number; color?: [number, number, number] }[]) => {
    sectionHeader(title);
    if (rows.length === 0) {
      text('No data.', margin, y, { size: 10, color: [120, 120, 120] });
      y += 20;
      return;
    }
    const max = Math.max(1, ...rows.map(r => r.sec));
    for (const r of rows.slice(0, 10)) {
      ensureRoom(24);
      if (r.color) {
        doc.setFillColor(...r.color);
        doc.circle(margin + 4, y - 3, 3, 'F');
        text(r.label, margin + 14, y, { size: 10 });
      } else {
        text(r.label, margin, y, { size: 10 });
      }
      text(fmtHM(r.sec), margin + contentW - 60, y, { size: 10, bold: true });
      y += 6;
      bar(margin, y, contentW, 6, r.sec / max, r.color ?? [60, 90, 200]);
      y += 14;
    }
  };

  const subjectRows = Array.from(stats.perSubject.entries())
    .map(([id, sec]) => ({ label: subjectName(id), sec }))
    .sort((a, b) => b.sec - a.sec);
  breakdown('Subject-wise hours', subjectRows);

  const tagRows = Array.from(stats.perTag.entries())
    .map(([id, sec]) => { const t = tagInfo(id); return { label: t?.name ?? 'Unknown', sec, color: t ? hexToRgb(t.color) : undefined }; })
    .sort((a, b) => b.sec - a.sec);
  breakdown('Tag-wise hours', tagRows);

  const topicRows = Array.from(stats.perTopic.entries())
    .map(([label, sec]) => ({ label, sec }))
    .sort((a, b) => b.sec - a.sec);
  breakdown('Topic-wise hours', topicRows);

  if (sessions.length === 0) {
    ensureRoom(24);
    text('No sessions logged this week.', margin, y, { size: 10, color: [120, 120, 120] });
    y += 18;
  }

  // ------ Footer ------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Focused Crew · Weekly Report · ${rangeStr} · generated ${generatedStr} · page ${i} of ${pageCount}`, margin, pageH - 20);
  }

  doc.save(`task-pilot-weekly-${isoDay(stats.thisWeekStart)}.pdf`);
}
