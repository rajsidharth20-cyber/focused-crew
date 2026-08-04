/**
 * Renders a shareable "day analysis" card to a PNG blob using canvas.
 * Pure presentation — no data fetching happens here.
 */

export type CardTheme = 'midnight' | 'aurora' | 'sunset' | 'paper' | 'carbon';

export const CARD_THEMES: { id: CardTheme; label: string; swatch: string[] }[] = [
  { id: 'midnight', label: 'Midnight', swatch: ['#0b1224', '#1d4ed8'] },
  { id: 'aurora', label: 'Aurora', swatch: ['#06281f', '#34d399'] },
  { id: 'sunset', label: 'Sunset', swatch: ['#3b0d24', '#fb7185'] },
  { id: 'paper', label: 'Paper', swatch: ['#f6f4ef', '#111111'] },
  { id: 'carbon', label: 'Carbon', swatch: ['#111214', '#a3a3a3'] },
];

type Palette = {
  bgFrom: string;
  bgTo: string;
  fg: string;
  muted: string;
  accent: string;
  card: string;
  border: string;
};

const PALETTES: Record<CardTheme, Palette> = {
  midnight: { bgFrom: '#070c1a', bgTo: '#132146', fg: '#f8fafc', muted: '#93a4c8', accent: '#60a5fa', card: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)' },
  aurora: { bgFrom: '#04211a', bgTo: '#0b3b34', fg: '#ecfdf5', muted: '#8fc9b6', accent: '#34d399', card: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)' },
  sunset: { bgFrom: '#2b0a1c', bgTo: '#5b1330', fg: '#fff1f2', muted: '#e3a8bb', accent: '#fb7185', card: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.14)' },
  paper: { bgFrom: '#faf8f3', bgTo: '#efece3', fg: '#14110d', muted: '#6b6459', accent: '#b45309', card: 'rgba(0,0,0,0.04)', border: 'rgba(0,0,0,0.10)' },
  carbon: { bgFrom: '#0c0d0f', bgTo: '#1a1c1f', fg: '#fafafa', muted: '#9ca3af', accent: '#e5e7eb', card: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.10)' },
};

export interface DayAnalysisData {
  name: string;
  dateLabel: string;
  objectives: { task: string; completed: boolean }[];
  studyMinutes: number;
  sessions: number;
  focusStreak?: number;
  weeklyDone?: number;
  weeklyTotal?: number;
}

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const truncate = (ctx: CanvasRenderingContext2D, text: string, maxW: number) => {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
};

export function renderDayAnalysis(theme: CardTheme, data: DayAnalysisData): HTMLCanvasElement {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const p = PALETTES[theme];

  // Background
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, p.bgFrom);
  grad.addColorStop(1, p.bgTo);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Accent glow
  const glow = ctx.createRadialGradient(W * 0.85, 120, 20, W * 0.85, 120, 520);
  glow.addColorStop(0, p.accent + '55');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const M = 80;
  let y = 130;

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = p.accent;
  ctx.font = '600 28px Inter, system-ui, sans-serif';
  ctx.fillText('DAY ANALYSIS', M, y);

  y += 68;
  ctx.fillStyle = p.fg;
  ctx.font = '700 58px Inter, system-ui, sans-serif';
  ctx.fillText(truncate(ctx, data.name, W - M * 2), M, y);

  y += 46;
  ctx.fillStyle = p.muted;
  ctx.font = '400 28px Inter, system-ui, sans-serif';
  ctx.fillText(data.dateLabel, M, y);

  // Progress ring
  const done = data.objectives.filter(o => o.completed).length;
  const total = data.objectives.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const cx = W - M - 110;
  const cy = 250;
  ctx.lineWidth = 22;
  ctx.strokeStyle = p.border;
  ctx.beginPath();
  ctx.arc(cx, cy, 92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = p.accent;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, 92, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct) / 100);
  ctx.stroke();
  ctx.fillStyle = p.fg;
  ctx.font = '700 46px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${pct}%`, cx, cy + 16);
  ctx.textAlign = 'left';

  // Stat tiles
  y = 400;
  const hrs = Math.floor(data.studyMinutes / 60);
  const mins = data.studyMinutes % 60;
  const tiles: { label: string; value: string }[] = [
    { label: 'Study time', value: hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m` },
    { label: 'Sessions', value: String(data.sessions) },
    { label: 'Objectives', value: `${done}/${total}` },
  ];
  if (data.focusStreak !== undefined) tiles.push({ label: 'Streak', value: `${data.focusStreak}d` });

  const cols = 2;
  const gap = 24;
  const tW = (W - M * 2 - gap) / cols;
  const tH = 150;
  tiles.forEach((t, i) => {
    const x = M + (i % cols) * (tW + gap);
    const ty = y + Math.floor(i / cols) * (tH + gap);
    ctx.fillStyle = p.card;
    roundRect(ctx, x, ty, tW, tH, 28);
    ctx.fill();
    ctx.strokeStyle = p.border;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = p.muted;
    ctx.font = '500 24px Inter, system-ui, sans-serif';
    ctx.fillText(t.label.toUpperCase(), x + 32, ty + 54);
    ctx.fillStyle = p.fg;
    ctx.font = '700 52px Inter, system-ui, sans-serif';
    ctx.fillText(t.value, x + 32, ty + 116);
  });

  y += Math.ceil(tiles.length / cols) * (tH + gap) + 30;

  // Objectives list
  ctx.fillStyle = p.accent;
  ctx.font = '600 26px Inter, system-ui, sans-serif';
  ctx.fillText("TODAY'S OBJECTIVES", M, y);
  y += 46;

  const list = data.objectives.slice(0, 8);
  if (list.length === 0) {
    ctx.fillStyle = p.muted;
    ctx.font = '400 30px Inter, system-ui, sans-serif';
    ctx.fillText('No objectives logged today.', M, y + 20);
  }
  list.forEach(o => {
    const boxY = y - 24;
    ctx.strokeStyle = o.completed ? p.accent : p.border;
    ctx.lineWidth = 3;
    roundRect(ctx, M, boxY, 34, 34, 10);
    ctx.stroke();
    if (o.completed) {
      ctx.fillStyle = p.accent;
      roundRect(ctx, M, boxY, 34, 34, 10);
      ctx.fill();
      ctx.strokeStyle = p.bgFrom;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(M + 9, boxY + 18);
      ctx.lineTo(M + 15, boxY + 24);
      ctx.lineTo(M + 25, boxY + 11);
      ctx.stroke();
    }
    ctx.fillStyle = o.completed ? p.muted : p.fg;
    ctx.font = '500 30px Inter, system-ui, sans-serif';
    ctx.fillText(truncate(ctx, o.task, W - M * 2 - 60), M + 54, y + 4);
    y += 58;
  });

  if (data.objectives.length > list.length) {
    ctx.fillStyle = p.muted;
    ctx.font = '400 26px Inter, system-ui, sans-serif';
    ctx.fillText(`+${data.objectives.length - list.length} more`, M + 54, y + 4);
  }

  // Weekly targets footer line
  if (data.weeklyTotal) {
    ctx.fillStyle = p.muted;
    ctx.font = '500 28px Inter, system-ui, sans-serif';
    ctx.fillText(`Weekly targets · ${data.weeklyDone ?? 0}/${data.weeklyTotal} done`, M, H - 150);
  }

  // Footer
  ctx.fillStyle = p.muted;
  ctx.font = '600 26px Inter, system-ui, sans-serif';
  ctx.fillText('Task Pilot', M, H - 80);

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png', 0.95)
  );
}
