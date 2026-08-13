import { useState } from 'react';
import { MessagesSquare, Users, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Chat from './Chat';
import StudyGroups from './StudyGroups';
import Feed from './Feed';
import { BottomNav } from '@/components/shell/BottomNav';
import { useUnreadMessages } from '@/hooks/use-unread-messages';

type Tab = 'feed' | 'chats' | 'groups';

const ORDER: Tab[] = ['feed', 'chats', 'groups'];

export default function SocialHub() {
  const [tab, setTab] = useState<Tab>('feed');
  const { total: unread } = useUnreadMessages();

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'feed', label: 'Feed', icon: Sparkles },
    { id: 'chats', label: 'Chats', icon: MessagesSquare, badge: unread },
    { id: 'groups', label: 'Groups', icon: Users },
  ];


  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <h1 className="text-[17px] font-bold tracking-tight">Social hub</h1>
          <div className="mt-2.5 mb-2 grid grid-cols-3 gap-1 p-1 rounded-2xl bg-muted/50">
            {tabs.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative flex items-center justify-center gap-1.5 h-9 rounded-xl text-[12.5px] font-semibold transition-colors ${
                    active ? 'text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="social-tab"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="absolute inset-0 rounded-xl bg-primary"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    <Icon className="w-4 h-4" />
                    {t.label}
                    {!!t.badge && t.badge > 0 && (
                      <span className={`min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold grid place-items-center ${active ? 'bg-primary-foreground/25' : 'bg-primary text-primary-foreground'}`}>
                        {t.badge > 9 ? '9+' : t.badge}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col max-w-2xl w-full mx-auto pb-24 overflow-x-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: tab === 'chats' ? -16 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: tab === 'chats' ? 16 : -16 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 min-h-0 flex flex-col"
          >
            {tab === 'chats' ? <Chat embedded /> : <StudyGroups embedded />}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
}
