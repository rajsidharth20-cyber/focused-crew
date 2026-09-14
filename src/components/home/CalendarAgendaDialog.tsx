import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Repeat2, Target } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TodayTimeline } from '@/components/TodayTimeline';
import { getEffectiveToday } from '@/lib/day-boundary';
import type { AgendaDateData, Subject } from '@/hooks/use-planner-store';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Subject[];
  loadDate: (date: string) => Promise<AgendaDateData>;
}

const toIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fromIso = (date: string) => new Date(`${date}T00:00:00`);

export function CalendarAgendaDialog({ open, onOpenChange, subjects, loadDate }: Props) {
  const [selected, setSelected] = useState(getEffectiveToday);
  const [data, setData] = useState<AgendaDateData>({ objectives: [], commitments: [], events: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const cache = useRef(new Map<string, AgendaDateData>());

  useEffect(() => {
    if (!open) return;
    const cached = cache.current.get(selected);
    if (cached) {
      setData(cached);
      setError(false);
      return;
    }
    let current = true;
    setLoading(true);
    setError(false);
    loadDate(selected)
      .then(result => {
        if (!current) return;
        cache.current.set(selected, result);
        setData(result);
      })
      .catch(() => current && setError(true))
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [loadDate, open, selected]);

  const selectedDate = useMemo(() => fromIso(selected), [selected]);
  const subjectName = (id: string) => subjects.find(subject => subject.id === id)?.name || 'General';
  const move = (days: number) => {
    const next = fromIso(selected);
    next.setDate(next.getDate() + days);
    setSelected(toIso(next));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-lg p-4 sm:p-6">
        <DialogHeader className="pr-7 text-left">
          <DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Calendar</DialogTitle>
          <DialogDescription>Select a date to see its objectives and schedule.</DialogDescription>
        </DialogHeader>

        <div className="grid items-start gap-4 md:grid-cols-[300px_minmax(0,1fr)]">
          <div className="rounded-lg border border-border/60 bg-card/50">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={date => date && setSelected(toIso(date))}
              initialFocus
              className="mx-auto w-fit"
            />
          </div>

          <div className="min-w-0 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="icon" onClick={() => move(-1)} aria-label="Previous day"><ChevronLeft /></Button>
              <div className="min-w-0 text-center">
                <div className="text-sm font-semibold">{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                {selected !== getEffectiveToday() && <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setSelected(getEffectiveToday())}>Today</Button>}
              </div>
              <Button variant="outline" size="icon" onClick={() => move(1)} aria-label="Next day"><ChevronRight /></Button>
            </div>

            {loading ? (
              <div className="space-y-2" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-secondary/50" />)}</div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">This date could not be loaded. Please try again.</div>
            ) : (
              <>
                <section className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4 text-primary" /> Objectives</div>
                  {data.objectives.length === 0 ? <p className="rounded-lg border border-border/50 p-3 text-xs text-muted-foreground">No objectives planned for this day.</p> : (
                    <div className="space-y-2">
                      {data.objectives.map(objective => (
                        <div key={objective.id} className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/50 p-3">
                          <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${objective.completed ? 'text-primary' : 'text-muted-foreground'}`} />
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm font-medium ${objective.completed ? 'line-through text-muted-foreground' : ''}`}>{objective.task}</div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                              <span>{subjectName(objective.subjectId)}</span><span>{objective.priority} priority</span><span>{objective.estimatedMinutes} min</span>
                              {objective.templateId && <span className="inline-flex items-center gap-1"><Repeat2 className="h-3 w-3" /> Recurring</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-primary" /> Agenda</div>
                  <TodayTimeline date={selected} title="Day timeline" commitments={data.commitments} events={data.events} objectives={data.objectives} />
                </section>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}