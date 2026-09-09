import { jsPDF } from 'jspdf';

/* ------------------------------------------------------------------ *
 * Focused Crew — Daily Focus Report renderer (pure, no network/IO)
 * ------------------------------------------------------------------ */

export interface Stat {
  label: string;
  value: string;
  hint?: string;
}

export interface ReportData {
  name: string;
  dateStr: string;
  statusLabel: string;
  statusHint: string;
  stats: Stat[];
  ai: { well: string[]; attention: string[]; priority: string };
  plannedVsActual: { label: string; plannedMin: number; actualMin: number }[];
  subjects: { name: string; minutes: number; share: number }[];
  punctuality: { label: string; value: string }[];
  timeline: { startMin: number; endMin: number; label: string }[];
  week: { label: string; minutes: number }[];
  weekSummary: Stat[];
  patterns: { label: string; value: string }[];
  targets: string[];
  notes: { subject: string; note: string }[];
  oneThing: { action: string; why: string };
}

const FOREST: [number, number, number] = [17, 61, 41];
const FOREST_DEEP: [number, number, number] = [10, 38, 26];
const GREEN: [number, number, number] = [46, 190, 113];
const INK: [number, number, number] = [23, 33, 28];
const MUTED: [number, number, number] = [110, 125, 116];
const LINE: [number, number, number] = [223, 231, 226];
const PAPER: [number, number, number] = [248, 250, 248];
const CARD: [number, number, number] = [255, 255, 255];

const DASH = '\u2014';

export const fmtMin = (m: number | null | undefined) => {
  if (m == null || !Number.isFinite(m)) return DASH;
  const v = Math.round(m);
  if (v <= 0) return '0m';
  const h = Math.floor(v / 60);
  const r = v % 60;
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
};

export function buildDailyReport(data: ReportData): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 44;
  const CW = W - M * 2;
  let y = 0;

  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setStroke = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  const paintPage = () => {
    setFill(PAPER);
    doc.rect(0, 0, W, H, 'F');
  };

  const newPage = (title?: string) => {
    doc.addPage();
    paintPage();
    y = M;
    if (title) pageTitle(title);
  };

  const room = (needed: number) => H - M - 26 - y >= needed;
  const ensure = (needed: number, title?: string) => {
    if (!room(needed)) newPage(title);
  };

  const pageTitle = (label: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setText(GREEN);
    doc.text(label.toUpperCase(), M, y, { charSpace: 1.2 });
    y += 8;
    setStroke(LINE);
    doc.setLineWidth(0.8);
    doc.line(M, y, M + CW, y);
    y += 20;
  };

  const section = (label: string, minRoom = 90) => {
    ensure(minRoom + 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    setText(FOREST);
    doc.text(label.toUpperCase(), M, y, { charSpace: 1 });
    y += 6;
    setStroke(LINE);
    doc.setLineWidth(0.7);
    doc.line(M, y, M + CW, y);
    y += 16;
  };

  const paragraph = (text: string, opts: { size?: number; color?: [number, number, number]; bold?: boolean; x?: number; w?: number } = {}) => {
    const size = opts.size ?? 9.5;
    const x = opts.x ?? M;
    const w = opts.w ?? CW;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    setText(opts.color ?? INK);
    const lines = doc.splitTextToSize(text, w) as string[];
    const lh = size * 1.42;
    for (const line of lines) {
      ensure(lh);
      doc.text(line, x, y);
      y += lh;
    }
  };

  const bullets = (items: string[], color: [number, number, number] = INK) => {
    for (const it of items) {
      const before = y;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      setText(GREEN);
      ensure(14);
      doc.text('\u2022', M + 2, y);
      setText(color);
      paragraph(it, { size: 9.5, color, x: M + 14, w: CW - 14 });
      if (y === before) y += 13;
      y += 3;
    }
  };

  /* ---------------- PAGE 1 ---------------- */
  paintPage();

  // Brand header band
  setFill(FOREST_DEEP);
  doc.rect(0, 0, W, 116, 'F');
  setFill(GREEN);
  doc.rect(0, 116, W, 3, 'F');

  // logo mark
  try {
    doc.addImage(BRAND_LOGO_DATA_URL, 'PNG', M, 30, 30, 30);
  } catch {
    setFill(GREEN);
    doc.roundedRect(M, 30, 30, 30, 9, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    setText(FOREST_DEEP);
    doc.text('FC', M + 15, 50, { align: 'center' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setText(GREEN);
  doc.text('FOCUSED CREW', M + 42, 42, { charSpace: 2 });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  setText([255, 255, 255]);
  doc.text('Daily Focus Report', M + 42, 62);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setText([186, 205, 193]);
  doc.text(`${data.name} \u00B7 ${data.dateStr}`, M + 42, 78);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  setText([140, 172, 152]);
  doc.text('Understand your day. Improve tomorrow.', M + 42, 94);

  y = 146;

  // Status strip
  setFill([238, 246, 240]);
  doc.roundedRect(M, y, CW, 46, 10, 10, 'F');
  setFill(GREEN);
  doc.roundedRect(M, y, 4, 46, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setText(FOREST);
  doc.text(data.statusLabel, M + 16, y + 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(MUTED);
  const hintLines = doc.splitTextToSize(data.statusHint, CW - 32) as string[];
  doc.text(hintLines.slice(0, 1), M + 16, y + 35);
  y += 62;

  // Stat cards
  section('Your day at a glance', 160);
  {
    const cols = 3;
    const gap = 10;
    const cardW = (CW - gap * (cols - 1)) / cols;
    const cardH = 62;
    data.stats.forEach((s, i) => {
      const col = i % cols;
      const rowStart = col === 0;
      if (rowStart) ensure(cardH + gap);
      const x = M + col * (cardW + gap);
      const top = y;
      setFill(CARD);
      setStroke(LINE);
      doc.setLineWidth(0.7);
      doc.roundedRect(x, top, cardW, cardH, 9, 9, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      setText(MUTED);
      doc.text(s.label.toUpperCase(), x + 11, top + 17, { charSpace: 0.6 });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      setText(s.value === DASH ? MUTED : FOREST);
      doc.text(s.value, x + 11, top + 39);
      if (s.hint) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        setText(MUTED);
        doc.text(doc.splitTextToSize(s.hint, cardW - 20)[0], x + 11, top + 52);
      }
      if (col === cols - 1 || i === data.stats.length - 1) y = top + cardH + gap;
    });
    y += 6;
  }

  // AI review
  section('AI daily review', 150);
  const aiBlock = (title: string, render: () => void) => {
    ensure(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setText(GREEN);
    doc.text(title.toUpperCase(), M, y, { charSpace: 0.8 });
    y += 13;
    render();
    y += 8;
  };
  aiBlock('What went well', () =>
    data.ai.well.length ? bullets(data.ai.well) : paragraph('No completed activity logged today.', { color: MUTED })
  );
  aiBlock('Needs attention', () =>
    data.ai.attention.length ? bullets(data.ai.attention) : paragraph('Nothing notable.', { color: MUTED })
  );
  aiBlock("Tomorrow's priority", () => paragraph(data.ai.priority, { size: 10 }));

  /* ---------------- PAGE 2 ---------------- */
  newPage('Your data');

  section('Planned vs actual', 110);
  if (data.plannedVsActual.length === 0) {
    paragraph('No planned objectives with tracked time today.', { color: MUTED });
    y += 8;
  } else {
    const maxV = Math.max(1, ...data.plannedVsActual.map(r => Math.max(r.plannedMin, r.actualMin)));
    const labelW = 130;
    const barW = CW - labelW - 78;
    for (const r of data.plannedVsActual.slice(0, 8)) {
      ensure(34);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setText(INK);
      const nameLines = (doc.splitTextToSize(r.label, labelW - 8) as string[]).slice(0, 2);
      doc.text(nameLines, M, y + 8);
      const bx = M + labelW;
      // planned (light)
      setFill([222, 234, 226]);
      doc.roundedRect(bx, y, Math.max(2, (r.plannedMin / maxV) * barW), 7, 3, 3, 'F');
      // actual
      setFill(GREEN);
      doc.roundedRect(bx, y + 11, Math.max(2, (r.actualMin / maxV) * barW), 7, 3, 3, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      setText(MUTED);
      doc.text(`plan ${fmtMin(r.plannedMin)}`, bx + barW + 8, y + 6);
      setText(FOREST);
      doc.text(`done ${fmtMin(r.actualMin)}`, bx + barW + 8, y + 17);
      y += 30;
    }
    y += 4;
  }

  section('Subject breakdown', 100);
  if (data.subjects.length === 0) {
    paragraph('No focused time logged today.', { color: MUTED });
    y += 8;
  } else {
    ensure(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setText(MUTED);
    doc.text('SUBJECT', M, y);
    doc.text('FOCUSED', M + CW - 150, y);
    doc.text('SHARE', M + CW - 60, y);
    y += 8;
    setStroke(LINE);
    doc.line(M, y, M + CW, y);
    y += 14;
    for (const s of data.subjects.slice(0, 10)) {
      ensure(24);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      setText(INK);
      const nm = (doc.splitTextToSize(s.name, CW - 175) as string[])[0];
      doc.text(nm, M, y);
      doc.setFont('helvetica', 'bold');
      setText(FOREST);
      doc.text(fmtMin(s.minutes), M + CW - 150, y);
      doc.text(`${Math.round(s.share)}%`, M + CW - 60, y);
      y += 7;
      setFill([232, 240, 234]);
      doc.roundedRect(M, y, CW, 4, 2, 2, 'F');
      setFill(GREEN);
      doc.roundedRect(M, y, Math.max(2, (s.share / 100) * CW), 4, 2, 2, 'F');
      y += 16;
    }
    y += 4;
  }

  section('Punctuality', 70);
  {
    const cols = 2;
    const gap = 10;
    const cardW = (CW - gap) / cols;
    data.punctuality.forEach((p, i) => {
      const col = i % cols;
      if (col === 0) ensure(40);
      const x = M + col * (cardW + gap);
      const top = y;
      setFill(CARD);
      setStroke(LINE);
      doc.roundedRect(x, top, cardW, 34, 8, 8, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      setText(MUTED);
      doc.text(p.label, x + 10, top + 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      setText(p.value === DASH ? MUTED : FOREST);
      doc.text(p.value, x + 10, top + 27);
      if (col === cols - 1 || i === data.punctuality.length - 1) y = top + 34 + gap;
    });
    y += 6;
  }

  section('Focus timeline', 80);
  if (data.timeline.length === 0) {
    paragraph('No session timestamps logged today.', { color: MUTED });
    y += 6;
  } else {
    ensure(70);
    const trackY = y + 16;
    const trackH = 12;
    setFill([234, 240, 236]);
    doc.roundedRect(M, trackY, CW, trackH, 5, 5, 'F');
    for (const b of data.timeline) {
      const x1 = M + (Math.min(1440, Math.max(0, b.startMin)) / 1440) * CW;
      const x2 = M + (Math.min(1440, Math.max(0, b.endMin)) / 1440) * CW;
      setFill(GREEN);
      doc.roundedRect(x1, trackY, Math.max(2.5, x2 - x1), trackH, 3, 3, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setText(MUTED);
    ['00', '06', '12', '18', '24'].forEach((lbl, i) => {
      const x = M + (i / 4) * CW;
      doc.text(lbl, x, trackY + trackH + 12, { align: i === 0 ? 'left' : i === 4 ? 'right' : 'center' });
    });
    y = trackY + trackH + 26;
    const first = data.timeline[0];
    const last = data.timeline[data.timeline.length - 1];
    const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
    paragraph(`${data.timeline.length} focus block${data.timeline.length > 1 ? 's' : ''} between ${hm(first.startMin)} and ${hm(last.endMin)}.`, { size: 8.5, color: MUTED });
    y += 6;
  }

  /* ---------------- PAGE 3 ---------------- */
  newPage('Patterns & trends');

  section('Last 7 days', 150);
  {
    const summaryCols = data.weekSummary.length || 1;
    const gap = 10;
    const cardW = (CW - gap * (summaryCols - 1)) / summaryCols;
    ensure(52);
    const top = y;
    data.weekSummary.forEach((s, i) => {
      const x = M + i * (cardW + gap);
      setFill(CARD);
      setStroke(LINE);
      doc.roundedRect(x, top, cardW, 46, 9, 9, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      setText(MUTED);
      doc.text(s.label.toUpperCase(), x + 10, top + 16, { charSpace: 0.5 });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      setText(s.value === DASH ? MUTED : FOREST);
      doc.text(s.value, x + 10, top + 35);
    });
    y = top + 46 + 16;

    // bar chart
    const chartH = 96;
    ensure(chartH + 40);
    const maxV = Math.max(1, ...data.week.map(d => d.minutes));
    const slot = CW / data.week.length;
    const barW = Math.min(30, slot * 0.5);
    const base = y + chartH;
    setStroke(LINE);
    doc.setLineWidth(0.7);
    doc.line(M, base, M + CW, base);
    data.week.forEach((d, i) => {
      const cx = M + slot * i + slot / 2;
      const h = (d.minutes / maxV) * (chartH - 18);
      if (d.minutes > 0) {
        setFill(GREEN);
        doc.roundedRect(cx - barW / 2, base - h, barW, h, 3, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        setText(FOREST);
        doc.text(fmtMin(d.minutes), cx, base - h - 5, { align: 'center' });
      } else {
        setFill([232, 238, 234]);
        doc.roundedRect(cx - barW / 2, base - 3, barW, 3, 1.5, 1.5, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      setText(MUTED);
      doc.text(d.label, cx, base + 13, { align: 'center' });
    });
    y = base + 28;
  }

  section('Your productivity patterns', 90);
  if (data.patterns.length === 0) {
    paragraph('Not enough history yet to detect patterns. Log a few more sessions.', { color: MUTED });
    y += 8;
  } else {
    for (const p of data.patterns) {
      ensure(20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setText(MUTED);
      doc.text(p.label, M, y);
      doc.setFont('helvetica', 'bold');
      setText(INK);
      const v = (doc.splitTextToSize(p.value, CW * 0.5) as string[])[0];
      doc.text(v, M + CW, y, { align: 'right' });
      y += 6;
      setStroke([238, 243, 239]);
      doc.line(M, y, M + CW, y);
      y += 14;
    }
    y += 2;
  }

  if (data.notes.length) {
    section('Session notes', 70);
    for (const n of data.notes.slice(0, 8)) {
      ensure(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      setText(FOREST);
      doc.text(n.subject, M, y);
      y += 12;
      paragraph(n.note, { size: 9, color: INK, x: M, w: CW });
      y += 8;
    }
  }

  section('Next 7 days', 80);
  if (data.targets.length === 0) {
    paragraph('Not enough history to set reliable targets yet.', { color: MUTED });
    y += 8;
  } else {
    for (const t of data.targets) {
      ensure(20);
      setStroke(GREEN);
      doc.setLineWidth(1);
      doc.rect(M + 1, y - 7.5, 8, 8, 'S');
      paragraph(t, { size: 9.5, x: M + 18, w: CW - 18 });
      y += 8;
    }
  }

  // One thing card
  ensure(120);
  y += 6;
  {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const actionLines = doc.splitTextToSize(data.oneThing.action, CW - 44) as string[];
    const whyLines = doc.splitTextToSize(data.oneThing.why, CW - 44) as string[];
    const cardH = 54 + actionLines.length * 15 + 16 + whyLines.length * 12;
    if (!room(cardH)) newPage('Patterns & trends');
    setFill(FOREST_DEEP);
    doc.roundedRect(M, y, CW, cardH, 12, 12, 'F');
    setFill(GREEN);
    doc.roundedRect(M + 22, y + 20, 4, cardH - 40, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setText(GREEN);
    doc.text("TOMORROW'S ONE THING", M + 36, y + 30, { charSpace: 1 });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    setText([255, 255, 255]);
    let ty = y + 52;
    for (const l of actionLines) { doc.text(l, M + 36, ty); ty += 15; }
    ty += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setText(GREEN);
    doc.text('WHY', M + 36, ty);
    ty += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setText([196, 214, 202]);
    for (const l of whyLines) { doc.text(l, M + 36, ty); ty += 12; }
    y += cardH + 10;
  }

  /* ---------------- Footers ---------------- */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    setStroke(LINE);
    doc.setLineWidth(0.7);
    doc.line(M, H - 34, W - M, H - 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setText(MUTED);
    doc.text('Focused Crew \u00B7 Daily Focus Report', M, H - 21);
    doc.text(`${data.dateStr}  \u00B7  Page ${i} of ${pages}`, W - M, H - 21, { align: 'right' });
  }

  return doc;
}
