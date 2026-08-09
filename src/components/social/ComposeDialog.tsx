import { useRef, useState } from 'react';
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

  const reset = () => {
    setFile(null);
    setPreview('');
    setCaption('');
  };

  const pick = (f: File | null) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast({ title: 'Image too large', description: 'Please pick an image under 8 MB.', variant: 'destructive' });
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!user) return;
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
            <button
              onClick={reset}
              aria-label="Remove image"
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 grid place-items-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-28 rounded-2xl border border-dashed border-border grid place-items-center gap-1 text-muted-foreground"
          >
            <ImagePlus className="w-5 h-5" />
            <span className="text-[12px] font-medium">Add a photo</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => pick(e.target.files?.[0] ?? null)}
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

        <Button onClick={submit} disabled={busy || (!file && !caption.trim())} className="rounded-full">
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Share
        </Button>
      </DialogContent>
    </Dialog>
  );
}
