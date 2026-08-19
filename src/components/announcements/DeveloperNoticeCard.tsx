import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Megaphone } from 'lucide-react';
import { AnnouncementDetail } from './AnnouncementDetail';
import { TYPE_LABEL, useLatestAnnouncement, useReadIds } from '@/hooks/use-announcements';

/** Compact "from the team" notice on the Home screen. Renders nothing when there is no live notice. */
export function DeveloperNoticeCard() {
  const { data: latest } = useLatestAnnouncement();
  const { data: readIds } = useReadIds();
  const [open, setOpen] = useState(false);

  if (!latest) return null;
  const unread = !readIds?.has(latest.id);
  const highlight = latest.is_important && unread;

  return (
    <>
      <section
        className={`relative overflow-hidden rounded-[24px] border-2 bg-gradient-to-br from-primary/15 via-card/80 to-accent/10 p-4 shadow-lg backdrop-blur ${
          unread ? 'border-primary/70 ring-2 ring-primary/20' : 'border-primary/30'
        }`}
      >
        {highlight && (
          <span
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/25 blur-2xl"
          />
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-widest text-primary">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/20">
              <Megaphone className="h-3.5 w-3.5" />
            </span>
            From the Focused Crew team
            {unread && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[9.5px] font-bold tracking-wider text-primary-foreground">
                NEW
              </span>
            )}
          </div>
          <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
            {TYPE_LABEL[latest.type] ?? latest.type}
          </span>
        </div>

        <button onClick={() => setOpen(true)} className="press mt-2 w-full text-left">
          <h3 className="text-[16px] font-bold leading-snug">{latest.title}</h3>
          <p className="mt-1 line-clamp-3 text-[12.5px] leading-relaxed text-muted-foreground">
            {latest.short_description || latest.content}
          </p>
          <span className="press mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-primary-foreground shadow">
            {latest.action_text || 'Read more'} <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </button>

        <Link to="/announcements" className="mt-2 block text-[11px] text-muted-foreground">
          All announcements
        </Link>
      </section>

      <AnnouncementDetail announcement={latest} open={open} onOpenChange={setOpen} />
    </>
  );
}
