import { useEffect, useId, useRef, useState } from 'react'
import { readMobilePrototypeFile } from '../session/mobile-prototype-host-rpc'
import { artifactPreviewSlots } from '../session/mobile-artifact-preview-slots'
import { artifactThumbnailLimiter } from '../session/mobile-artifact-read-limiter'
import { rpcClientKey } from '../session/mobile-rpc-client-key'
import type { RpcClient } from '../transport/rpc-client'
import type { MobilePrototypeFileRef } from './use-mobile-prototype-file'

/** A read the host gave no answer to is asked again, this many times in all and no more. */
export const MAX_THUMBNAIL_READ_ATTEMPTS = 3
/** The pause before a card asks again after a read that got no answer. */
export const THUMBNAIL_READ_RETRY_DELAY_MS = 2_000

/**
 * The HTML a tile draws live: read once per file while the tile is near the screen, and shown only
 * while it holds one of the few preview slots (each live WebView is a renderer process on Android).
 * Null while there is nothing to draw: the tile stays an empty page.
 */
export function useMobilePrototypeThumbnailHtml(
  client: RpcClient | null,
  file: MobilePrototypeFileRef | null,
  active: boolean
): string | null {
  const slotId = useId()
  const [html, setHtml] = useState<string | null>(null)
  const requestedFor = useRef<string | null>(null)
  const failures = useRef<{ token: string; count: number } | null>(null)
  const [retryWait, setRetryWait] = useState(false)
  const [retryTick, setRetryTick] = useState(0)
  // The pause before a retry is a timer its own effect owns, so it is cleared with the card.
  useEffect(() => {
    if (!retryWait) {
      return
    }
    const timer = setTimeout(() => {
      setRetryWait(false)
      setRetryTick((tick) => tick + 1)
    }, THUMBNAIL_READ_RETRY_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [retryWait])
  const sessionId = file?.sessionId
  const requestId = file?.requestId
  const fileName = file?.fileName

  useEffect(() => {
    if (
      !active ||
      client === null ||
      sessionId === undefined ||
      requestId === undefined ||
      fileName === undefined
    ) {
      return
    }
    const token = `${rpcClientKey(client)}|${sessionId}|${requestId}|${fileName}`
    if (requestedFor.current === token) {
      return
    }
    requestedFor.current = token
    let current = true
    // Why: a read with no verdict (the host unreachable) is asked again; a refusal is final.
    const noAnswer = (): void => {
      const failed = failures.current?.token === token ? failures.current.count : 0
      if (failed + 1 >= MAX_THUMBNAIL_READ_ATTEMPTS) {
        return
      }
      failures.current = { token, count: failed + 1 }
      setRetryWait(true)
    }
    void artifactThumbnailLimiter(() =>
      readMobilePrototypeFile(client, { sessionId, requestId, fileName })
    ).then(
      (read) => {
        if (!current) {
          return
        }
        if (read.kind === 'ready') {
          failures.current = null
          setHtml(read.html)
        } else if (read.kind === 'unreachable') {
          noAnswer()
        }
      },
      () => {
        if (current) {
          noAnswer()
        }
      }
    )
    return () => {
      current = false
      // A cut-short read is asked again on the next pass.
      if (requestedFor.current === token) {
        requestedFor.current = null
      }
    }
  }, [active, client, sessionId, requestId, fileName, retryTick])

  const wantsLive = active && html !== null
  const [slotHeld, setSlotHeld] = useState(false)
  useEffect(() => {
    if (!wantsLive) {
      artifactPreviewSlots.release(slotId)
      setSlotHeld(false)
      return
    }
    const attempt = (): void => setSlotHeld(artifactPreviewSlots.acquire(slotId))
    attempt()
    const unsubscribe = artifactPreviewSlots.subscribe(attempt)
    return () => {
      unsubscribe()
      artifactPreviewSlots.release(slotId)
    }
  }, [wantsLive, slotId])

  return wantsLive && slotHeld ? html : null
}
