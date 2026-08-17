import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Megaphone } from 'lucide-react';
import { TYPE_LABEL, useMarkRead, type Announcement } from '@/hooks/use-announcements';

interface Props {
  announcement: Announcement | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Preview mode skips marking as read. */
  preview?: boolean;
}

export function AnnouncementDetail({ announcement, open, onOpenChange, preview }: Props) {
  const markRead = useMarkRead();

  useEffect(() => {
    if (open && announcement && !preview) markRead.mutate(announcement.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, announcement?.id, preview]);

  if (!announcement) return null;
  const a = announcement;
  const date = a.published_at ?? a.scheduled_for ?? a.created_at;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-primary">
            <Megaphone className="h-3.5 w-3.5" />
            {TYPE_LABEL[a.type] ?? a.type}
          </div>
          <DialogTitle className="text-left text-lg leading-snug">{a.title}</DialogTitle>
        </DialogHeader>

        <p className="text-[11px] text-muted-foreground">
          {new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </p>

        {a.image_url && (
          <img
            src={a.image_url}
            alt={a.title}
            loading="lazy"
            className="w-full rounded-2xl border border-border/50 object-cover"
          />
        )}

        <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/90">{a.content}</div>

        {a.action_text && a.action_url && (
          <Button asChild className="w-full">
            <a href={a.action_url} target={a.action_url.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
              {a.action_text}
            </a>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
