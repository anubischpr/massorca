import { useEffect, useId, useRef, useState } from 'react'
import { readMobilePrototypeFile } from '../session/mobile-prototype-host-rpc'
import { artifactPreviewSlots } from '../session/mobile-artifact-preview-slots'
import { artifactThumbnailLimiter } from '../session/mobile-artifact-read-limiter'
import { rpcClientKey } from '../session/mobile-rpc-client-key'
import type { RpcClient } from '../transport/rpc-client'
import type { MobilePrototypeFileRef } from './use-mobile-prototype-file'

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
    void artifactThumbnailLimiter(() =>
      readMobilePrototypeFile(client, { sessionId, requestId, fileName })
    ).then((read) => {
      if (current && read.kind === 'ready') {
        setHtml(read.html)
      }
    })
    return () => {
      current = false
      // A cut-short read is asked again on the next pass.
      if (requestedFor.current === token) {
        requestedFor.current = null
      }
    }
  }, [active, client, sessionId, requestId, fileName])

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
