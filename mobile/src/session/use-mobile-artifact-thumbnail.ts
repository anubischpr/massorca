import { useEffect, useState } from 'react'
import { artifactThumbnailLimiter } from './mobile-artifact-read-limiter'
import { viewerKindOf, type MobileArtifactTarget } from './mobile-chat-artifacts-model'
import {
  cachedMobileNativeChatVisual,
  readMobileNativeChatVisual,
  type MobileNativeChatVisualSource
} from './mobile-native-chat-visual-read'
import { cachedRecordedFileContent, readRecordedFilePreview } from './mobile-recorded-file-cache'
import type { MobileChatSurfaceRecordedSource } from './mobile-chat-surface-snapshot'

/** What a page's tile shows: its HTML once read, or the glyph when there is nothing to draw. */
export type ArtifactThumbnailState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'page'; html: string }
  | { kind: 'glyph' }

/** Only HTML and SVG pages thumbnail; Markdown and source keep their glyph. */
function isThumbnailable(target: MobileArtifactTarget): boolean {
  return target.kind === 'visual' || viewerKindOf(target.path).kind === 'html'
}

function cachedHtml(
  source: MobileChatSurfaceRecordedSource,
  target: MobileArtifactTarget
): string | null {
  if (target.kind === 'visual') {
    return cachedMobileNativeChatVisual(source, target.file)?.html ?? null
  }
  return cachedRecordedFileContent(source, target.path)
}

function readHtml(
  source: MobileNativeChatVisualSource,
  target: MobileArtifactTarget
): Promise<string | null> {
  if (target.kind === 'visual') {
    return readMobileNativeChatVisual(source, target.file).then((read) =>
      read.kind === 'ready' ? read.html : null
    )
  }
  return readRecordedFilePreview(source, target.path)
}

function initialState(
  source: MobileChatSurfaceRecordedSource | null,
  target: MobileArtifactTarget
): ArtifactThumbnailState {
  if (!source || !isThumbnailable(target)) {
    return { kind: 'glyph' }
  }
  const html = cachedHtml(source, target)
  return html === null ? { kind: 'idle' } : { kind: 'page', html }
}

/**
 * A page's thumbnail HTML. Reads start only while `active` (the tile is near the list), go through
 * a shared limiter, and settle once: a page that cannot be read keeps its glyph until the list
 * remounts it, so a host that refuses it is not asked in a loop.
 */
export function useArtifactThumbnail(
  target: MobileArtifactTarget,
  source: MobileChatSurfaceRecordedSource | null,
  active: boolean
): ArtifactThumbnailState {
  const client = source?.client ?? null
  const sessionId = source?.sessionId ?? null
  const key = JSON.stringify(target)
  const [state, setState] = useState(() => initialState(source, target))

  useEffect(() => {
    if (!active || client === null || sessionId === null || !isThumbnailable(target)) {
      return
    }
    if (state.kind === 'page' || state.kind === 'glyph') {
      return
    }
    let cancelled = false
    setState({ kind: 'loading' })
    const read = { client, sessionId }
    void artifactThumbnailLimiter(() => readHtml(read, target)).then((html) => {
      if (!cancelled) {
        setState(html === null ? { kind: 'glyph' } : { kind: 'page', html })
      }
    })
    return () => {
      cancelled = true
    }
    // The target enters through its key: its object identity changes on every render.
  }, [active, client, sessionId, key])

  return state
}
