import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import type { DailyObjective, Subject, WeeklyTarget, Commitment, PlannerEvent } from '@/hooks/use-planner-store';

interface SummaryInput {
  username: string | null;
  subjects: Subject[];
  dailyObjectives: DailyObjective[];
  weeklyTargets: WeeklyTarget[];
  commitments: Commitment[];
  events: PlannerEvent[];
}

const PRIORITY_LABEL: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export async function generateDailySummaryPDF(input: SummaryInput): Promise<void> {
  const { username, subjects, dailyObjectives, weeklyTargets, commitments, events } = input;
  const subjectMap = new Map(subjects.map(s => [s.id, s.name]));

  const done = dailyObjectives.filter(o => o.completed);
  const pending = dailyObjectives.filter(o => !o.completed);
  const totalMin = dailyObjectives.reduce((a, o) => a + (o.estimatedMinutes || 0), 0);
  const doneMin = done.reduce((a, o) => a + (o.estimatedMinutes || 0), 0);
  const pct = dailyObjectives.length > 0 ? Math.round((done.length / dailyObjectives.length) * 100) : 0;

  // Ask AI for a reflection (best-effort)
  let aiSummary = '';
  try {
    const compact = {
      progress: { done: done.length, total: dailyObjectives.length, pct, doneMin, totalMin },
      objectives: dailyObjectives.map(o => ({
        task: o.task, subject: subjectMap.get(o.subjectId) || 'General',
        priority: o.priority, completed: o.completed, minutes: o.estimatedMinutes,
        notes: o.progressNotes?.slice(-2) || [],
      })),
      weeklyTargets: weeklyTargets.map(t => ({
        target: t.target, subject: subjectMap.get(t.subjectId) || 'General', completed: t.completed,
      })),
      commitments: commitments.map(c => ({ title: c.title, start: c.startTime, end: c.endTime })),
      events: events.slice(0, 5).map(e => ({ title: e.title, date: e.eventDate })),
    };
    const { data, error } = await supabase.functions.invoke('daily-summary', { body: { state: compact } });
    if (!error && data?.summary) aiSummary = String(data.summary);
  } catch (e) {
    console.warn('AI summary failed, continuing without it', e);
  }

  // ---------- PDF ----------
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  let y = margin;

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const ensureRoom = (needed: number) => {
    if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
  };

  const writeParagraph = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}) => {
    const size = opts.size ?? 11;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color ?? [30, 30, 30]));
    const lines = doc.splitTextToSize(text, contentW);
    const lh = size * 1.35;
    for (const line of lines) {
      ensureRoom(lh);
      doc.text(line, margin, y);
      y += lh;
    }
    y += opts.gap ?? 6;
  };

  const sectionHeader = (label: string) => {
    ensureRoom(34);
    y += 6;
    doc.setDrawColor(220);
    doc.line(margin, y, margin + contentW, y);
    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(60, 90, 200);
    doc.text(label.toUpperCase(), margin, y);
    y += 14;
  };

  // Header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 90, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Task Pilot — Daily Summary', margin, 48);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(200, 210, 230);
  doc.text(`${username ? username + '  ·  ' : ''}${dateStr}`, margin, 68);
  y = 120;

  // Progress stat block
  doc.setFillColor(245, 247, 252);
  doc.roundedRect(margin, y, contentW, 70, 10, 10, 'F');
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(`${pct}%`, margin + 20, y + 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text('objectives complete', margin + 20, y + 60);

  const col2 = margin + 180;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(`${done.length}/${dailyObjectives.length}`, col2, y + 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text('completed', col2, y + 48);

  const col3 = margin + 300;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(`${doneMin} / ${totalMin} min`, col3, y + 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text('focused time', col3, y + 48);
  y += 90;

  // AI reflection
  if (aiSummary) {
    sectionHeader('AI Reflection');
    writeParagraph(aiSummary, { size: 11, gap: 10 });
  }

  // Completed
  sectionHeader(`Completed (${done.length})`);
  if (done.length === 0) {
    writeParagraph('Nothing marked complete today.', { size: 10, color: [120, 120, 120] });
  } else {
    for (const o of done) {
      writeParagraph(`✓  ${o.task}`, { size: 11, bold: true });
      writeParagraph(`   ${subjectMap.get(o.subjectId) || 'General'} · ${PRIORITY_LABEL[o.priority] || o.priority} · ${o.estimatedMinutes} min`, { size: 9, color: [110, 110, 110] });
    }
  }

  // Pending
  sectionHeader(`Still to land (${pending.length})`);
  if (pending.length === 0) {
    writeParagraph('All clear. Runway is empty.', { size: 10, color: [120, 120, 120] });
  } else {
    for (const o of pending) {
      writeParagraph(`○  ${o.task}`, { size: 11, bold: true });
      writeParagraph(`   ${subjectMap.get(o.subjectId) || 'General'} · ${PRIORITY_LABEL[o.priority] || o.priority} · ${o.estimatedMinutes} min`, { size: 9, color: [110, 110, 110] });
    }
  }

  // Weekly
  if (weeklyTargets.length > 0) {
    sectionHeader('Weekly targets');
    for (const t of weeklyTargets) {
      writeParagraph(`${t.completed ? '✓' : '○'}  ${t.target}`, { size: 11 });
      writeParagraph(`   ${subjectMap.get(t.subjectId) || 'General'}`, { size: 9, color: [110, 110, 110] });
    }
  }

  // Commitments
  if (commitments.length > 0) {
    sectionHeader("Today's commitments");
    for (const c of commitments) {
      writeParagraph(`• ${c.startTime}–${c.endTime}  ${c.title}`, { size: 11 });
    }
  }

  // Upcoming
  if (events.length > 0) {
    sectionHeader('Upcoming');
    for (const e of events.slice(0, 6)) {
      writeParagraph(`• ${e.eventDate ?? 'Recurring'}  ${e.title}`, { size: 11 });
    }
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Task Pilot · ${dateStr} · page ${i} of ${pageCount}`, margin, pageH - 20);
  }

  const filename = `task-pilot-summary-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
