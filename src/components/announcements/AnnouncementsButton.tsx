import { useNavigate } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { useLatestAnnouncement, useReadIds } from '@/hooks/use-announcements';

/** Compact header button next to the logo. Shows a "New" pill when the latest notice is unread. */
export function AnnouncementsButton() {
  const navigate = useNavigate();
  const { data: latest } = useLatestAnnouncement();
  const { data: readIds } = useReadIds();

  if (!latest) return null;
  const unread = !readIds?.has(latest.id);

  return (
    <button
      onClick={() => navigate('/announcements')}
      aria-label={unread ? 'New announcement from the team' : 'Announcements'}
      className={`press relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-semibold ${
        unread
          ? 'border-primary/50 bg-primary/15 text-primary'
          : 'border-border/60 bg-background/60 text-muted-foreground'
      }`}
    >
      <Megaphone className="h-3.5 w-3.5" />
      {unread && (
        <>
          <span className="hidden sm:inline">New announcement</span>
          <span className="sm:hidden">New</span>
          <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background animate-pulse" />
        </>
      )}
    </button>
  );
}
