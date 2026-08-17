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
        className={`rounded-[24px] border bg-card/60 p-4 backdrop-blur ${
          highlight ? 'border-primary/50 shadow-md' : 'border-border/50'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary/80">
            <Megaphone className="h-3.5 w-3.5" />
            From the Focused Crew team
            {highlight && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Unread" />}
          </div>
          <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
            {TYPE_LABEL[latest.type] ?? latest.type}
          </span>
        </div>

        <button onClick={() => setOpen(true)} className="press mt-2 w-full text-left">
          <h3 className="text-[14.5px] font-semibold leading-snug">{latest.title}</h3>
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {latest.short_description || latest.content}
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-primary">
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
