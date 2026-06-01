/**
 * lib/image.ts
 *
 * Shared helpers for handling base64 image data URLs sent from the client
 * (attached photos of handwritten work). Used by the chat tutor and the FRQ
 * grader to build provider-specific vision blocks.
 */

export const IMAGE_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
export type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

/** Split a `data:<media>;base64,<data>` URL into parts (or null if malformed/unsupported). */
export function parseDataUrl(
  dataUrl: string,
): { mediaType: ImageMediaType; data: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!m) return null;
  const mediaType = m[1] as ImageMediaType;
  if (!IMAGE_MEDIA_TYPES.includes(mediaType)) return null;
  return { mediaType, data: m[2] };
}
