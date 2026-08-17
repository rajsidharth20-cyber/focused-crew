import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/shell/BottomNav';
import { AnnouncementDetail } from '@/components/announcements/AnnouncementDetail';
import {
  PAGE_SIZE,
  TYPE_LABEL,
  useAnnouncementHistory,
  useReadIds,
  type Announcement,
} from '@/hooks/use-announcements';

const isLatest = (a: Announcement) => {
  const at = new Date(a.published_at ?? a.created_at).getTime();
  return Date.now() - at < 7 * 24 * 3600_000;
};

export default function Announcements() {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useAnnouncementHistory(page);
  const { data: readIds } = useReadIds();
  const [selected, setSelected] = useState<Announcement | null>(null);

  const rows = data?.rows ?? [];
  const latest = rows.filter(isLatest);
  const earlier = rows.filter(a => !isLatest(a));
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const Row = (a: Announcement) => {
    const unread = !readIds?.has(a.id);
    return (
      <button
        key={a.id}
        onClick={() => setSelected(a)}
        className="press flex w-full items-start gap-3 rounded-2xl border border-border/50 bg-card/60 p-3 text-left"
      >
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium">{a.title}</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {TYPE_LABEL[a.type] ?? a.type} ·{' '}
            {new Date(a.published_at ?? a.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen app-surface pb-28" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="sticky top-0 z-30 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
          <Link to="/" aria-label="Back" className="press grid h-9 w-9 place-items-center rounded-full bg-foreground/5">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-[15px] font-bold">Announcements</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border/60 p-10 text-center">
            <Megaphone className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-[13px] text-muted-foreground">No announcements yet.</p>
          </div>
        ) : (
          <>
            {latest.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-primary/80">Latest</h2>
                {latest.map(Row)}
              </section>
            )}
            {earlier.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Earlier</h2>
                {earlier.map(Row)}
              </section>
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      <AnnouncementDetail announcement={selected} open={!!selected} onOpenChange={v => !v && setSelected(null)} />
      <BottomNav />
    </div>
  );
}
