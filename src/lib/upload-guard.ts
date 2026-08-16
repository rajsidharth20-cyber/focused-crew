/** Shared client-side guard for image uploads (type + size). */
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Throws a user-friendly error when the file is not an accepted image or is too large. */
export function assertImageFile(file: File, maxBytes = MAX_IMAGE_BYTES) {
  if (!ALLOWED.includes(file.type.toLowerCase())) {
    throw new Error('Only JPEG, PNG, WebP, GIF or HEIC images are allowed.');
  }
  if (file.size > maxBytes) {
    throw new Error(`Image must be under ${Math.round(maxBytes / (1024 * 1024))} MB.`);
  }
}
