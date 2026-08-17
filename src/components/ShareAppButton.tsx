import { Share2 } from 'lucide-react';
import { toast } from 'sonner';

const SHARE_URL = 'https://schedule-whisperer-89.lovable.app';
const SHARE_TEXT = 'Focused Crew — an AI-powered daily planner. Try it:';

export function ShareAppButton() {
  const handleShare = async () => {
    const shareData = { title: 'Focused Crew', text: SHARE_TEXT, url: SHARE_URL };
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share(shareData);
        return;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Could not share link');
    }
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md hover:bg-secondary"
      aria-label="Share app link"
    >
      <Share2 className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Share</span>
    </button>
  );
}
