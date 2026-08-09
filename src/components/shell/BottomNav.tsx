import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, CalendarDays, Timer, MessagesSquare, LayoutGrid, Plus } from 'lucide-react';
import { useUnreadMessages } from '@/hooks/use-unread-messages';

export const QUICK_ADD_EVENT = 'taskpilot:quick-add';

type Item = { to: string; icon: React.ComponentType<{ className?: string }>; label: string; badge?: number };

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { total: unreadTotal } = useUnreadMessages();

  const items: Item[] = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/planner', icon: CalendarDays, label: 'Planner' },
    { to: '/study', icon: Timer, label: 'Study' },
    { to: '/feed', icon: Sparkles, label: 'Feed' },
    { to: '/social', icon: MessagesSquare, label: 'Social', badge: unreadTotal },
    { to: '/more', icon: LayoutGrid, label: 'More' },
  ];

  const isActive = (to: string) =>
    to === '/'
      ? location.pathname === '/'
      : to === '/social'
        ? ['/social', '/chat', '/groups'].some(p => location.pathname.startsWith(p))
        : location.pathname.startsWith(to);


  const quickAdd = () => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => window.dispatchEvent(new CustomEvent(QUICK_ADD_EVENT)), 220);
    } else {
      window.dispatchEvent(new CustomEvent(QUICK_ADD_EVENT));
    }
    if ('vibrate' in navigator) navigator.vibrate?.(8);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}
    >
      <div className="mx-auto w-full max-w-md px-3">
        <nav className="dock pointer-events-auto relative grid grid-cols-5 items-center h-[62px] px-1.5">
          <button
            onClick={quickAdd}
            aria-label="Add task"
            className="absolute left-1/2 -translate-x-1/2 -top-7 w-[52px] h-[52px] rounded-full m3-fab text-primary-foreground grid place-items-center active:scale-90 transition-transform"
          >
            <Plus className="w-6 h-6" />
          </button>

          {items.map((item, i) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            const isCenter = i === 2;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 h-full rounded-2xl transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                } ${isCenter ? 'opacity-100' : ''}`}
              >
                {active && (
                  <motion.span
                    layoutId="dock-pill"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    className="absolute inset-x-1.5 inset-y-1.5 rounded-2xl bg-primary/12 border border-primary/20"
                  />
                )}
                <motion.span
                  animate={{ scale: active ? 1.1 : 1, y: active ? -1 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  className="relative z-10"
                >
                  <Icon className="w-[19px] h-[19px]" />
                </motion.span>
                <span className={`relative z-10 text-[9.5px] font-semibold tracking-tight ${isCenter ? 'mt-0' : ''}`}>
                  {item.label}
                </span>
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute top-1 right-[24%] min-w-[15px] h-[15px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold grid place-items-center z-10">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
