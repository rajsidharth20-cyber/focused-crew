import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Share2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { CARD_THEMES, canvasToBlob, renderDayAnalysis, type CardTheme } from '@/lib/day-analysis-image';
import type { DailyObjective, WeeklyTarget } from '@/hooks/use-planner-store';
import type { StudySession } from '@/hooks/use-study-store';
import { cn } from '@/lib/utils';

interface Props {
  username: string | null;
  objectives: DailyObjective[];
  weeklyTargets: WeeklyTarget[];
  sessions: StudySession[];
  streak?: number;
  children: React.ReactNode;
}

const isToday = (iso: string) => {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

/** Generates a shareable day-analysis image in several visual themes. */
export function DayAnalysisDialog({ username, objectives, weeklyTargets, sessions, streak, children }: Props) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<CardTheme>('midnight');
  const [preview, setPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const data = useMemo(() => {
    const todays = sessions.filter(s => isToday(s.startedAt));
    return {
      name: username ? `@${username}` : 'Pilot',
      dateLabel: new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      objectives: objectives.map(o => ({ task: o.task, completed: o.completed })),
      studyMinutes: Math.round(todays.reduce((a, s) => a + (s.durationSeconds || 0), 0) / 60),
      sessions: todays.length,
      focusStreak: streak,
      weeklyDone: weeklyTargets.filter(t => t.completed).length,
      weeklyTotal: weeklyTargets.length,
    };
  }, [username, objectives, weeklyTargets, sessions, streak]);

  useEffect(() => {
    if (!open) return;
    const canvas = renderDayAnalysis(theme, data);
    canvasRef.current = canvas;
    setPreview(canvas.toDataURL('image/png'));
  }, [open, theme, data]);

  const fileName = `day-analysis-${new Date().toISOString().slice(0, 10)}.png`;

  const download = async () => {
    if (!canvasRef.current) return;
    const blob = await canvasToBlob(canvasRef.current);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Image saved');
  };

  const share = async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await canvasToBlob(canvasRef.current);
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My day analysis' });
      } else {
        await download();
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-sm p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="w-4 h-4" /> Day analysis image
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-2xl overflow-hidden border border-border/60 bg-muted/30 max-h-[46vh] overflow-y-auto">
          {preview && <img src={preview} alt="Preview of your day analysis card" className="w-full block" />}
        </div>

        <div className="flex gap-2 overflow-x-auto py-1">
          {CARD_THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                'shrink-0 rounded-xl px-3 py-2 text-xs font-medium border transition',
                theme === t.id ? 'border-primary ring-2 ring-primary/30' : 'border-border/60'
              )}
              style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})`, color: '#fff' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={download} className="rounded-xl">
            <Download className="w-4 h-4 mr-2" /> Save
          </Button>
          <Button onClick={share} className="rounded-xl">
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
