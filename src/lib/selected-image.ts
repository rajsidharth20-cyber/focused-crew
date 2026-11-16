import { assertImageFile } from '@/lib/upload-guard';

/** Copy temporary phone-picker bytes before its file permission expires. */
export async function snapshotSelectedImage(source: File): Promise<File> {
  assertImageFile(source);
  try {
    const bytes = await source.arrayBuffer();
    if (bytes.byteLength === 0) throw new Error('Empty image');
    return new File([bytes], source.name, { type: source.type, lastModified: source.lastModified });
  } catch {
    throw new Error('This photo could not be opened. Please select it again, or choose a photo saved on your phone.');
  }
}