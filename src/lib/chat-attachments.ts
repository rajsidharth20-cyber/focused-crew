import { supabase } from '@/integrations/supabase/client';

export const MAX_CHAT_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export interface ChatAttachment {
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
}
export const isChatPhoto = (type: string | null) => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type ?? '');
export const attachmentLabel = (m: Partial<ChatAttachment> & { message: string }) => m.message || (m.attachment_path ? isChatPhoto(m.attachment_type ?? null) ? 'Photo' : `File: ${m.attachment_name ?? 'Attachment'}` : '');

export async function snapshotChatFile(source: File): Promise<File> {
  if (source.size < 1) throw new Error('This file is empty.');
  if (source.size > MAX_CHAT_ATTACHMENT_BYTES) throw new Error('Choose a file up to 20 MB.');
  try {
    const bytes = await source.arrayBuffer();
    if (bytes.byteLength !== source.size) throw new Error('Incomplete file');
    return new File([bytes], source.name.slice(0, 255) || 'Attachment', { type: source.type || 'application/octet-stream' });
  } catch {
    throw new Error('This file could not be opened. Please select it again, or choose a file saved on your phone.');
  }
}

export async function uploadChatAttachment(sender: string, recipient: string, file: File): Promise<ChatAttachment> {
  const path = `${sender}/${recipient}/${crypto.randomUUID()}`;
  const { error } = await supabase.storage.from('chat-attachments').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (error) throw error;
  return { attachment_path: path, attachment_name: file.name, attachment_type: file.type || 'application/octet-stream', attachment_size: file.size };
}