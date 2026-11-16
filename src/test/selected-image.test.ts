import { describe, expect, it, vi } from 'vitest';
import { snapshotSelectedImage } from '@/lib/selected-image';

function read(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

describe('phone photo selection', () => {
  it('keeps independent upload bytes after the picker loses access', async () => {
    const source = new File(['photo bytes'], 'photo.jpg', { type: 'image/jpeg' });
    const pickerRead = vi.fn().mockResolvedValue(new TextEncoder().encode('photo bytes').buffer);
    Object.defineProperty(source, 'arrayBuffer', { value: pickerRead });
    const snapshot = await snapshotSelectedImage(source);
    pickerRead.mockRejectedValue(new DOMException('Permission expired', 'NotReadableError'));
    expect(snapshot).not.toBe(source);
    expect(Array.from(new Uint8Array(await read(snapshot)))).toEqual(Array.from(new TextEncoder().encode('photo bytes')));
    expect(snapshot.name).toBe('photo.jpg');
    expect(snapshot.type).toBe('image/jpeg');
    expect(pickerRead).toHaveBeenCalledTimes(1);
  });

  it('rejects an unreadable picker file before uploading', async () => {
    const source = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(source, 'arrayBuffer', { value: vi.fn().mockRejectedValue(new DOMException('', 'NotReadableError')) });
    await expect(snapshotSelectedImage(source)).rejects.toThrow('Please select it again');
  });

  it('preserves the smaller profile-photo limit before copying bytes', async () => {
    const source = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'avatar.jpg', { type: 'image/jpeg' });
    const pickerRead = vi.fn();
    Object.defineProperty(source, 'arrayBuffer', { value: pickerRead });
    await expect(snapshotSelectedImage(source, 2 * 1024 * 1024)).rejects.toThrow('under 2 MB');
    expect(pickerRead).not.toHaveBeenCalled();
  });
});