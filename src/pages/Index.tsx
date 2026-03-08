import { motion } from 'framer-motion';
import { Zap, Trash2, LogOut } from 'lucide-react';
import { SubjectManager } from '@/components/SubjectManager';
import { WeeklyTargets } from '@/components/WeeklyTargets';
import { DailyObjectives } from '@/components/DailyObjectives';
import { Commitments } from '@/components/Commitments';
import { AIAdvisor } from '@/components/AIAdvisor';
import { usePlannerStore } from '@/hooks/use-planner-store';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const store = usePlannerStore();
  const { signOut } = useAuth();

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-foreground tracking-tight">
                FocusFlow
              </h1>
              <p className="text-xs text-muted-foreground">{today}</p>
            </div>
          </div>
          <button
            onClick={store.clearDay}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Day
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* AI Advisor - Top Priority */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <AIAdvisor
            state={{
              subjects: store.subjects,
              weeklyTargets: store.weeklyTargets,
              dailyObjectives: store.dailyObjectives,
              commitments: store.commitments,
            }}
          />
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <SubjectManager
                subjects={store.subjects}
                onAdd={store.addSubject}
                onRemove={store.removeSubject}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <WeeklyTargets
                subjects={store.subjects}
                targets={store.weeklyTargets}
                onAdd={store.addWeeklyTarget}
                onToggle={store.toggleWeeklyTarget}
                onRemove={store.removeWeeklyTarget}
              />
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <DailyObjectives
                subjects={store.subjects}
                objectives={store.dailyObjectives}
                onAdd={store.addDailyObjective}
                onToggle={store.toggleDailyObjective}
                onAddNote={store.addProgressNote}
                onRemove={store.removeDailyObjective}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Commitments
                commitments={store.commitments}
                onAdd={store.addCommitment}
                onRemove={store.removeCommitment}
              />
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
