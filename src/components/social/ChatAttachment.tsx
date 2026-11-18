import { useEffect, useState } from 'react';
import { Download, File, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ChatAttachment as Attachment, isChatPhoto } from '@/lib/chat-attachments';
import { toast } from 'sonner';

export function ChatAttachment({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const photo = isChatPhoto(attachment.attachment_type);
  useEffect(() => {
    setUrl(''); setFailed(false);
    if (!attachment.attachment_path || !photo) return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.storage.from('chat-attachments').createSignedUrl(attachment.attachment_path ?? '', 300);
      if (!cancelled) { setUrl(data?.signedUrl ?? ''); setFailed(!!error); }
    };
    void load();
    const refresh = window.setInterval(load, 240000);
    return () => { cancelled = true; window.clearInterval(refresh); };
  }, [attachment.attachment_path, photo]);

  const download = async () => {
    if (!attachment.attachment_path) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage.from('chat-attachments').download(attachment.attachment_path);
      if (error || !data) throw error;
      const href = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
      const link = document.createElement('a'); link.href = href;
      link.download = attachment.attachment_name || 'Attachment';
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 60000);
    } catch { toast.error('Could not download this file. Please try again.'); }
    finally { setDownloading(false); }
  };
  return <div className="space-y-2 mb-1 min-w-0">
    {photo && (failed ? <p className="text-xs">Photo unavailable</p> : url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open photo"><img src={url} alt={attachment.attachment_name ?? 'Shared photo'} onError={() => setFailed(true)} className="max-h-72 w-full object-contain rounded-md" /></a> : <Loader2 className="w-5 h-5 animate-spin" />)}
    <div className="flex items-center gap-2 min-w-0">
      {!photo && <File className="w-5 h-5 shrink-0" />}
      <div className="min-w-0 flex-1"><p className="text-sm break-all">{attachment.attachment_name}</p><p className="text-xs opacity-70">{((attachment.attachment_size ?? 0) / 1024).toFixed(0)} KB</p></div>
      <Button type="button" size="icon" variant="ghost" onClick={download} disabled={downloading} aria-label={`Download ${attachment.attachment_name}`} title="Download file">{downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}</Button>
    </div>
  </div>;
}