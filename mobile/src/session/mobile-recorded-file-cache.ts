import type { MobileChatSurfaceRecordedSource } from './mobile-chat-surface-snapshot'
import { readMobileRecordedFile } from './mobile-recorded-file-read'
import { rpcClientKey } from './mobile-rpc-client-key'

// Each entry is one page's text; the character bound is what caps memory.
const MAX_CACHE_ENTRIES = 32
const MAX_CACHE_CHARS = 4 * 1024 * 1024

const cache = new Map<string, string>()
const inFlight = new Map<string, Promise<string | null>>()

function cacheKey(source: MobileChatSurfaceRecordedSource, path: string): string {
  return JSON.stringify([rpcClientKey(source.client), source.sessionId, path])
}

/** The text a phone already holds for a recorded file, or null. Thumbnails and the viewer share it. */
export function cachedRecordedFileContent(
  source: MobileChatSurfaceRecordedSource,
  path: string
): string | null {
  return cache.get(cacheKey(source, path)) ?? null
}

function remember(key: string, content: string): void {
  cache.delete(key)
  cache.set(key, content)
  let chars = 0
  for (const value of cache.values()) {
    chars += value.length
  }
  // Oldest first: Map iteration follows insertion order, and a hit re-inserts.
  for (const [oldKey, value] of cache) {
    if (cache.size <= MAX_CACHE_ENTRIES && chars <= MAX_CACHE_CHARS) {
      break
    }
    if (oldKey === key) {
      continue
    }
    cache.delete(oldKey)
    chars -= value.length
  }
}

/**
 * Reads one recorded file for preview. A ready text is kept for the next reader; anything else is
 * not cached, so a later attempt asks the host again. Concurrent reads share one request. With
 * `revalidate`, a cached text is not trusted: the host is asked, since a later turn may have edited
 * the file.
 */
export async function readRecordedFilePreview(
  source: MobileChatSurfaceRecordedSource,
  path: string,
  options: { revalidate?: boolean } = {}
): Promise<string | null> {
  const key = cacheKey(source, path)
  const hit = cache.get(key)
  if (hit !== undefined && options.revalidate !== true) {
    return hit
  }
  const pending = inFlight.get(key)
  if (pending) {
    return pending
  }
  const read = readMobileRecordedFile(source, path)
    .then((result) => {
      if (result.kind !== 'ready') {
        return null
      }
      remember(key, result.content)
      return result.content
    })
    .finally(() => {
      inFlight.delete(key)
    })
  inFlight.set(key, read)
  return read
}

/** Keeps a ready text a reader just got, so the next reader paints it at once. */
export function rememberRecordedFileContent(
  source: MobileChatSurfaceRecordedSource,
  path: string,
  content: string
): void {
  remember(cacheKey(source, path), content)
}

/** Test seam: forget every cached recorded file. */
export function resetRecordedFileCacheForTest(): void {
  cache.clear()
  inFlight.clear()
}
