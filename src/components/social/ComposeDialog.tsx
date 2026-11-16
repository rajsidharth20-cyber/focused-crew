import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { uploadSocialImage } from '@/lib/social-media';
import { toast } from '@/hooks/use-toast';
import { snapshotSelectedImage } from '@/lib/selected-image';

type Mode = 'post' | 'story';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: Mode;
  onCreatePost: (input: { kind: 'photo' | 'text'; caption?: string; image_url?: string | null }) => Promise<void>;
  onCreateStory: (input: { image_url?: string | null; caption?: string }) => Promise<void>;
}

export function ComposeDialog({ open, onOpenChange, mode, onCreatePost, onCreateStory }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const selection = useRef(0);

  useEffect(() => () => { selection.current += 1; }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const reset = () => {
    selection.current += 1;
    setPreparing(false);
    setFile(null);
    setPreview('');
    setCaption('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const pick = async (f: File | null) => {
    if (!f) return;
    const current = ++selection.current;
    setPreparing(true);
    setFile(null);
    setPreview('');
    try {
      const snapshot = await snapshotSelectedImage(f);
      if (current !== selection.current) return;
      setFile(snapshot);
      setPreview(URL.createObjectURL(snapshot));
    } catch (e) {
      if (current !== selection.current) return;
      toast({ title: 'Could not open photo', description: e instanceof Error ? e.message : 'Please select the photo again.', variant: 'destructive' });
    } finally {
      if (current === selection.current) setPreparing(false);
    }
  };

  const submit = async () => {
    if (!user || preparing || busy) return;
    if (mode === 'story' && !file && !caption.trim()) return;
    if (mode === 'post' && !file && !caption.trim()) return;
    setBusy(true);
    try {
      const path = file ? await uploadSocialImage(user.id, file, mode === 'post' ? 'posts' : 'stories') : null;
      if (mode === 'post') {
        await onCreatePost({ kind: file ? 'photo' : 'text', caption, image_url: path });
      } else {
        await onCreateStory({ image_url: path, caption });
      }
      reset();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'Could not share',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (busy) return;
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === 'post' ? 'New post' : 'Add to your story'}</DialogTitle>
        </DialogHeader>

        {preview ? (
          <div className="relative">
            <img src={preview} alt="Selected" className="w-full max-h-64 object-cover rounded-2xl" />
            <Button
              variant="ghost"
              size="icon"
              disabled={busy}
              onClick={reset}
              aria-label="Remove image"
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 grid place-items-center"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            disabled={preparing || busy}
            onClick={() => fileRef.current?.click()}
            className="w-full h-28 rounded-2xl border border-dashed border-border grid place-items-center gap-1 text-muted-foreground"
          >
            {preparing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
            <span className="text-[12px] font-medium">{preparing ? 'Opening photo…' : 'Add a photo'}</span>
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy || preparing}
          onChange={e => {
            const selected = e.target.files?.[0] ?? null;
            e.target.value = '';
            void pick(selected);
          }}
        />

        <Textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder={mode === 'post' ? 'What did you study today?' : 'Say something…'}
          aria-label="Caption"
        />

        <p className="text-[11px] text-muted-foreground">
          Only your accepted friends can see this. {mode === 'story' && 'Stories disappear after 24 hours.'}
        </p>

        <Button onClick={submit} disabled={busy || preparing || (!file && !caption.trim())} className="rounded-full">
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Share
        </Button>
      </DialogContent>
    </Dialog>
  );
}
