import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Eye, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnnouncementDetail } from '@/components/announcements/AnnouncementDetail';
import {
  ANNOUNCEMENT_TYPES,
  TYPE_LABEL,
  statusOf,
  useAllAnnouncements,
  useDeleteAnnouncement,
  useIsStaff,
  useSaveAnnouncement,
  type Announcement,
  type AnnouncementType,
} from '@/hooks/use-announcements';

type Draft = {
  id?: string;
  title: string;
  short_description: string;
  content: string;
  type: AnnouncementType;
  is_important: boolean;
  image_url: string;
  action_text: string;
  action_url: string;
  scheduled_for: string;
};

const empty: Draft = {
  title: '',
  short_description: '',
  content: '',
  type: 'update',
  is_important: false,
  image_url: '',
  action_text: '',
  action_url: '',
  scheduled_for: '',
};

const toLocalInput = (iso: string | null) =>
  iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

export default function AdminAnnouncements() {
  const { isStaff, loading } = useIsStaff();
  const { data: rows, isLoading } = useAllAnnouncements();
  const save = useSaveAnnouncement();
  const del = useDeleteAnnouncement();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<Announcement | null>(null);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center app-surface">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="grid min-h-screen place-items-center app-surface px-6 text-center">
        <div>
          <h1 className="font-display text-lg font-bold">Admins only</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">You don't have access to this page.</p>
          <Button asChild className="mt-4">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const asPreview = (d: Draft): Announcement => ({
    id: d.id ?? 'preview',
    title: d.title || 'Untitled announcement',
    content: d.content,
    short_description: d.short_description || null,
    type: d.type,
    is_important: d.is_important,
    image_url: d.image_url || null,
    action_text: d.action_text || null,
    action_url: d.action_url || null,
    is_published: false,
    published_at: null,
    scheduled_for: d.scheduled_for ? new Date(d.scheduled_for).toISOString() : null,
    created_by: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const persist = async (mode: 'draft' | 'publish' | 'schedule') => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.content.trim()) {
      toast.error('Title and content are required.');
      return;
    }
    if (draft.action_text.trim() && !draft.action_url.trim()) {
      toast.error('Add a link for the button.');
      return;
    }
    if (mode === 'schedule' && !draft.scheduled_for) {
      toast.error('Pick a date and time to schedule.');
      return;
    }
    const scheduled = draft.scheduled_for ? new Date(draft.scheduled_for).toISOString() : null;
    const values = {
      title: draft.title.trim(),
      content: draft.content.trim(),
      short_description: draft.short_description.trim() || null,
      type: draft.type,
      is_important: draft.is_important,
      image_url: draft.image_url.trim() || null,
      action_text: draft.action_text.trim() || null,
      action_url: draft.action_url.trim() || null,
      is_published: mode !== 'draft',
      scheduled_for: mode === 'schedule' ? scheduled : null,
      published_at: mode === 'publish' ? new Date().toISOString() : mode === 'schedule' ? scheduled : null,
    };
    try {
      await save.mutateAsync({ id: draft.id, values: values as never });
      toast.success(mode === 'draft' ? 'Saved as draft' : mode === 'publish' ? 'Published' : 'Scheduled');
      setDraft(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const setPublished = async (a: Announcement, next: boolean) => {
    try {
      await save.mutateAsync({
        id: a.id,
        values: {
          title: a.title,
          content: a.content,
          is_published: next,
          published_at: next ? a.published_at ?? new Date().toISOString() : null,
        } as never,
      });
      toast.success(next ? 'Published' : 'Unpublished');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen app-surface pb-16" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="sticky top-0 z-30 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <Link to="/" aria-label="Back" className="press grid h-9 w-9 place-items-center rounded-full bg-foreground/5">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="flex-1 font-display text-[15px] font-bold">Announcements</h1>
          <Button size="sm" onClick={() => setDraft({ ...empty })}>
            <Plus className="mr-1 h-4 w-4" /> New
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (rows ?? []).length === 0 ? (
          <p className="py-16 text-center text-[13px] text-muted-foreground">No announcements yet.</p>
        ) : (
          (rows ?? []).map(a => (
            <div key={a.id} className="rounded-2xl border border-border/50 bg-card/60 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {statusOf(a)}
                </span>
                <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {TYPE_LABEL[a.type] ?? a.type}
                </span>
                {a.is_important && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                    Important
                  </span>
                )}
                <span className="ml-auto text-[10.5px] text-muted-foreground">{a.read_count} reads</span>
              </div>

              <h3 className="mt-2 text-[14px] font-semibold leading-snug">{a.title}</h3>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                Created {new Date(a.created_at).toLocaleDateString()}
                {a.published_at && ` · Published ${new Date(a.published_at).toLocaleDateString()}`}
                {a.scheduled_for && ` · Scheduled ${new Date(a.scheduled_for).toLocaleString()}`}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setPreview(a)}>
                  <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft({
                      id: a.id,
                      title: a.title,
                      short_description: a.short_description ?? '',
                      content: a.content,
                      type: a.type,
                      is_important: a.is_important,
                      image_url: a.image_url ?? '',
                      action_text: a.action_text ?? '',
                      action_url: a.action_url ?? '',
                      scheduled_for: toLocalInput(a.scheduled_for),
                    })
                  }
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPublished(a, !a.is_published)}>
                  {a.is_published ? 'Unpublish' : 'Publish'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm('Delete this announcement?')) del.mutate(a.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </main>

      {/* Editor */}
      <Dialog open={!!draft} onOpenChange={v => !v && setDraft(null)}>
        <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit announcement' : 'New announcement'}</DialogTitle>
          </DialogHeader>

          {draft && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="a-title">Title</Label>
                <Input id="a-title" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="a-short">Short description</Label>
                <Input
                  id="a-short"
                  value={draft.short_description}
                  onChange={e => setDraft({ ...draft, short_description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="a-content">Content</Label>
                <Textarea
                  id="a-content"
                  rows={6}
                  value={draft.content}
                  onChange={e => setDraft({ ...draft, content: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select
                    value={draft.type}
                    onValueChange={v => setDraft({ ...draft, type: v as AnnouncementType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANNOUNCEMENT_TYPES.map(t => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end justify-between gap-2 rounded-xl border border-border/50 px-3 py-2">
                  <Label htmlFor="a-imp" className="text-[12.5px]">
                    Important
                  </Label>
                  <Switch
                    id="a-imp"
                    checked={draft.is_important}
                    onCheckedChange={v => setDraft({ ...draft, is_important: v })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="a-img">Image URL (optional)</Label>
                <Input
                  id="a-img"
                  value={draft.image_url}
                  onChange={e => setDraft({ ...draft, image_url: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="a-btn">Button text</Label>
                  <Input
                    id="a-btn"
                    value={draft.action_text}
                    onChange={e => setDraft({ ...draft, action_text: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="a-url">Button link</Label>
                  <Input
                    id="a-url"
                    value={draft.action_url}
                    onChange={e => setDraft({ ...draft, action_url: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="a-sched">Schedule for (optional)</Label>
                <Input
                  id="a-sched"
                  type="datetime-local"
                  value={draft.scheduled_for}
                  onChange={e => setDraft({ ...draft, scheduled_for: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => draft && setPreview(asPreview(draft))}>
              Preview
            </Button>
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => persist('draft')}>
              Save draft
            </Button>
            {draft?.scheduled_for && (
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => persist('schedule')}>
                Schedule
              </Button>
            )}
            <Button className="w-full sm:w-auto" onClick={() => persist('publish')} disabled={save.isPending}>
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnnouncementDetail announcement={preview} open={!!preview} onOpenChange={v => !v && setPreview(null)} preview />
    </div>
  );
}
