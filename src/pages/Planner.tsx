import { motion } from 'framer-motion';
import { Plane, Swords, ArrowLeft, Calendar as CalendarIcon, Clock3, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TodayTimeline } from '@/components/TodayTimeline';
import { Commitments } from '@/components/Commitments';
import { UpcomingEvents } from '@/components/UpcomingEvents';
import { usePlannerStore } from '@/hooks/use-planner-store';
import { useTheme } from '@/hooks/use-theme';
import { useNow } from '@/hooks/use-now';
import { useEventReminders } from '@/hooks/use-event-reminders';

const Planner = () => {
  const store = usePlannerStore();
  useEventReminders(store.events, store.commitments);
  const { theme } = useTheme();
  const now = useNow(60_000);
  const ThemeIcon = theme === 'war' ? Swords : Plane;

  const today = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const withDeadline = store.dailyObjectives.filter(o => !o.completed && o.deadline).length;

  return (
    <div
      className="relative min-h-screen overflow-x-hidden pb-[calc(80px+env(safe-area-inset-bottom))]"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="aurora animate-float" style={{ width: 360, height: 360, background: 'hsl(var(--primary) / 0.2)', top: -140, right: -120 }} />
      </div>

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/75 border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 min-w-0 active:scale-[0.98] transition-transform">
            <div className="w-9 h-9 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-md shrink-0">
              <ArrowLeft className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="min-w-0 text-left">
              <h1 className="font-display text-[15px] font-bold tracking-tight leading-none truncate">Planner</h1>
              <p className="text-[10.5px] text-muted-foreground truncate mt-0.5">{today}</p>
            </div>
          </Link>
          <div className="flex items-center gap-2 text-muted-foreground">
            <ThemeIcon className="w-4 h-4 text-primary" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
        <motion.section
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="grid grid-cols-3 gap-2 sm:gap-3"
        >
          <MiniStat icon={Clock3} label="Stops" value={String(store.commitments.length)} />
          <MiniStat icon={CalendarIcon} label="Events" value={String(store.events.length)} />
          <MiniStat icon={Target} label="Deadlines" value={String(withDeadline)} />
        </motion.section>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
          <TodayTimeline
            commitments={store.commitments}
            events={store.events}
            objectives={store.dailyObjectives}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Commitments commitments={store.commitments} onAdd={store.addCommitment} onRemove={store.removeCommitment} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
          <UpcomingEvents events={store.events} onAdd={store.addEvent} onRemove={store.removeEvent} />
        </motion.div>
      </main>
    </div>
  );
};

function MiniStat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="glass-card px-3 py-3 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest font-display text-muted-foreground leading-none">{label}</div>
        <div className="text-base font-bold tabular-nums mt-0.5">{value}</div>
      </div>
    </div>
  );
}

export default Planner;
