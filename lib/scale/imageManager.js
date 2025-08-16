import * as FileSystem from "expo-file-system";

// ---------------------------------------------------------------------------
// Image reference manager
// ---------------------------------------------------------------------------
// Each temporary image captured during a cooking session can be referenced by
// multiple objects (e.g. a Frame and a State). To avoid deleting an image that
// is still in use, we maintain a reference count for every URI.

const _imageRefCounts = new Map();

/**
 * Increment reference count for a given image URI.
 * Safe to call multiple times; ignores falsy values.
 * @param {string} uri
 */
export function retainImage(uri) {
  if (!uri) return;
  const current = _imageRefCounts.get(uri) || 0;
  _imageRefCounts.set(uri, current + 1);
}

/**
 * Decrement reference count and delete the underlying file when it reaches 0.
 * If the URI was never retained we attempt to delete it immediately (best-effort).
 * @param {string} uri
 */
export function releaseImage(uri) {
  if (!uri) return;

  const current = _imageRefCounts.get(uri);

  // If we have a tracked count, decrement and delete when it hits zero.
  if (current !== undefined) {
    if (current > 1) {
      _imageRefCounts.set(uri, current - 1);
      return;
    }
    // count is 1 → will drop to zero: remove tracking and delete file
    _imageRefCounts.delete(uri);
  }

  // Either count just reached zero or we never tracked it; attempt deletion.
  // idempotent: true ensures no error if the file was already removed.
  FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}
