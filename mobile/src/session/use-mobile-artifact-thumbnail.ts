import { useEffect, useId, useRef, useState } from 'react'
import { artifactThumbnailLimiter } from './mobile-artifact-read-limiter'
import { artifactPreviewSlots } from './mobile-artifact-preview-slots'
import { viewerKindOf, type MobileArtifactTarget } from './mobile-chat-artifacts-model'
import type { MobileChatSurfaceRecordedSource } from './mobile-chat-surface-snapshot'
import {
  cachedMobileNativeChatVisual,
  readMobileNativeChatVisual,
  type MobileNativeChatVisualSource
} from './mobile-native-chat-visual-read'
import { cachedRecordedFileContent, readRecordedFilePreview } from './mobile-recorded-file-cache'
import { rpcClientKey } from './mobile-rpc-client-key'

/** What a page's tile shows: its live HTML, or the glyph when there is nothing to draw now. */
export type ArtifactThumbnailState = { kind: 'page'; html: string } | { kind: 'glyph' }

const GLYPH: ArtifactThumbnailState = { kind: 'glyph' }

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

/** A fresh read: a visual is always asked of the host, and a recorded file is revalidated, so a
 *  later turn's edit reaches the thumbnail. Null when the host gave no answer for it. */
function readHtml(
  source: MobileNativeChatVisualSource,
  target: MobileArtifactTarget
): Promise<string | null> {
  if (target.kind === 'visual') {
    return readMobileNativeChatVisual(source, target.file).then((read) =>
      read.kind === 'ready' ? read.html : null
    )
  }
  return readRecordedFilePreview(source, target.path, { revalidate: true })
}

/**
 * A page's thumbnail. The cached copy paints first; the host is asked once per mount and per source
 * (so a session that reconnects is asked again) and the answer replaces the copy. A page the host
 * cannot answer for keeps its last copy. A live WebView is drawn only while the page is near the
 * list and holds one of the few preview slots; otherwise the glyph stands in.
 *
 * The source may arrive after mount (a cold open): the glyph is decided per render from the source,
 * and the load runs as soon as it is there.
 */
export function useArtifactThumbnail(
  target: MobileArtifactTarget,
  source: MobileChatSurfaceRecordedSource | null,
  active: boolean
): ArtifactThumbnailState {
  const client = source?.client ?? null
  const sessionId = source?.sessionId ?? null
  const thumbnailable = isThumbnailable(target)
  const key = JSON.stringify(target)
  const slotId = useId()
  const [entry, setEntry] = useState<{ html: string | null }>(() => ({
    html: source && thumbnailable ? cachedHtml(source, target) : null
  }))
  const mounted = useRef(false)
  const requestedFor = useRef<string | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!active || !thumbnailable || client === null || sessionId === null) {
      return
    }
    const token = `${rpcClientKey(client)}|${sessionId}|${key}`
    if (requestedFor.current === token) {
      return
    }
    requestedFor.current = token
    const read = { client, sessionId }
    void artifactThumbnailLimiter(() => readHtml(read, target)).then((html) => {
      if (!mounted.current || html === null) {
        return
      }
      setEntry({ html })
    })
    // The target enters through its key: its object identity changes on every render.
  }, [active, thumbnailable, client, sessionId, key])

  const wantsLive = active && thumbnailable && source !== null && entry.html !== null
  const [slotHeld, setSlotHeld] = useState(false)
  useEffect(() => {
    if (!wantsLive) {
      artifactPreviewSlots.release(slotId)
      setSlotHeld(false)
      return
    }
    const attempt = () => setSlotHeld(artifactPreviewSlots.acquire(slotId))
    attempt()
    const unsubscribe = artifactPreviewSlots.subscribe(attempt)
    return () => {
      unsubscribe()
      artifactPreviewSlots.release(slotId)
    }
  }, [wantsLive, slotId])

  if (!source || !thumbnailable || entry.html === null || !wantsLive || !slotHeld) {
    return GLYPH
  }
  return { kind: 'page', html: entry.html }
}
