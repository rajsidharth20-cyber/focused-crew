import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { FileDown, Loader2, Trash2, LogOut, Users, Image as ImageIcon, Bell, ChevronRight } from 'lucide-react';
import { generateDailySummaryPDF } from '@/lib/daily-summary-pdf';
import { DayAnalysisDialog } from '@/components/DayAnalysisDialog';
import { ShareAppButton } from '@/components/ShareAppButton';
import { QuoteCard } from '@/components/QuoteCard';
import { DailyNote } from '@/components/DailyNote';
import { FlightProtocols } from '@/components/FlightProtocols';
import { SubjectManager } from '@/components/SubjectManager';
import { WeeklyTargets } from '@/components/WeeklyTargets';
import { BottomNav } from '@/components/shell/BottomNav';
import { usePlannerStore } from '@/hooks/use-planner-store';
import { useStudyStore } from '@/hooks/use-study-store';
import { useAuth } from '@/hooks/useAuth';
import { useTerms } from '@/lib/terms';

const More = () => {
  const store = usePlannerStore();
  const studyStore = useStudyStore();
  const { username, signOut } = useAuth();
  const t = useTerms();
  const [downloading, setDownloading] = useState(false);

  const handleDownloadSummary = async () => {
    setDownloading(true);
    const toastId = toast.loading('Preparing your daily summary…');
    try {
      await generateDailySummaryPDF({
        username,
        subjects: store.subjects,
        dailyObjectives: store.dailyObjectives,
        weeklyTargets: store.weeklyTargets,
        commitments: store.commitments,
        events: store.events,
      });
      toast.success('Summary downloaded', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Could not generate PDF', { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-x-hidden app-surface"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="aurora animate-float" style={{ width: 340, height: 340, background: 'hsl(var(--accent) / 0.2)', top: -120, right: -100 }} />
      </div>

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <h1 className="font-display text-[17px] font-bold tracking-tight">More</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-3 space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <QuoteCard />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.04 }}>
          <DailyNote />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}>
          <FlightProtocols protocols={store.protocols} onAdd={store.addProtocol} onRemove={store.removeProtocol} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.12 }}>
          <SubjectManager subjects={store.subjects} onAdd={store.addSubject} onRemove={store.removeSubject} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.16 }}>
          <WeeklyTargets
            subjects={store.subjects}
            targets={store.weeklyTargets}
            pastTargets={store.pastWeeklyTargets}
            onAdd={store.addWeeklyTarget}
            onToggle={store.toggleWeeklyTarget}
            onRemove={store.removeWeeklyTarget}
          />
        </motion.div>

        <section className="glass-card overflow-hidden divide-y divide-border/50">
          <Row to="/groups" icon={Users} label="Study groups" />
          <Row to="/settings/notifications" icon={Bell} label="Notification settings" />
          <DayAnalysisDialog
            username={username}
            objectives={store.dailyObjectives}
            weeklyTargets={store.weeklyTargets}
            sessions={studyStore.sessions}
          >
            <button className="w-full px-4 py-3.5 flex items-center gap-3 text-sm text-left press hover:bg-secondary/50">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1">Day analysis image</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </DayAnalysisDialog>
          <button
            onClick={handleDownloadSummary}
            disabled={downloading}
            className="w-full px-4 py-3.5 flex items-center gap-3 text-sm text-left press hover:bg-secondary/50 disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 text-muted-foreground" />}
            <span className="flex-1">Download summary PDF</span>
          </button>
          <div className="w-full px-4 py-3 flex items-center gap-3 text-sm">
            <ShareAppButton />
            <span className="flex-1">Share app link</span>
          </div>
        </section>

        <section className="glass-card overflow-hidden divide-y divide-border/50">
          <button
            onClick={() => store.clearDay()}
            className="w-full px-4 py-3.5 flex items-center gap-3 text-sm text-left text-destructive press hover:bg-destructive/5"
          >
            <Trash2 className="w-4 h-4" />
            <span className="flex-1">{t.clear}</span>
          </button>
          <button
            onClick={() => signOut()}
            className="w-full px-4 py-3.5 flex items-center gap-3 text-sm text-left press hover:bg-secondary/50"
          >
            <LogOut className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1">{t.logout}</span>
          </button>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

function Row({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link to={to} className="w-full px-4 py-3.5 flex items-center gap-3 text-sm press hover:bg-secondary/50">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </Link>
  );
}

export default More;
