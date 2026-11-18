import { describe, expect, it, vi } from 'vitest';
import { snapshotChatFile, attachmentLabel, isChatPhoto } from '@/lib/chat-attachments';

describe('private chat attachments', () => {
  it('copies picker bytes immediately for photos and arbitrary files', async () => {
    for (const type of ['image/jpeg', 'application/pdf', 'application/zip']) {
      const source = new File(['data'], 'test', { type });
      const read = vi.fn().mockResolvedValue(new TextEncoder().encode('data').buffer);
      Object.defineProperty(source, 'arrayBuffer', { value: read });
      const copy = await snapshotChatFile(source);
      read.mockRejectedValue(new Error('Permission expired'));
      expect(copy).not.toBe(source); expect(copy.size).toBe(4); expect(copy.type).toBe(type);
      expect(read).toHaveBeenCalledTimes(1);
    }
  });
  it('rejects empty and oversized attachments before reading', async () => {
    await expect(snapshotChatFile(new File([], 'empty'))).rejects.toThrow('empty');
    const file = new File(['a'], 'big');
    Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 + 1 });
    await expect(snapshotChatFile(file)).rejects.toThrow('20 MB');
  });
  it('rejects unreadable and incomplete files', async () => {
    const file = new File(['ab'], 'test');
    Object.defineProperty(file, 'arrayBuffer', { value: vi.fn().mockResolvedValue(new ArrayBuffer(1)) });
    await expect(snapshotChatFile(file)).rejects.toThrow('select it again');
  });
  it('previews only raster photos and gives attachment-only messages a label', () => {
    expect(isChatPhoto('image/svg+xml')).toBe(false);
    expect(isChatPhoto('text/html')).toBe(false);
    expect(attachmentLabel({ message: '', attachment_path: 'path', attachment_type: 'image/jpeg' })).toBe('Photo');
    expect(attachmentLabel({ message: '', attachment_path: 'path', attachment_type: 'application/pdf', attachment_name: 'notes.pdf' })).toBe('File: notes.pdf');
  });
});