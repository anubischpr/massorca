import { useCallback, useEffect, useState } from 'react'
import type { MobileChatSurfaceRecordedSource } from './mobile-chat-surface-snapshot'
import {
  cachedRecordedFileContent,
  rememberRecordedFileContent
} from './mobile-recorded-file-cache'
import { readMobileRecordedFile, type MobileRecordedFileRead } from './mobile-recorded-file-read'

export type MobileRecordedFileState = { kind: 'loading' } | MobileRecordedFileRead

/** One recorded file, read once per host, session and path. Only a manual `retry` asks again: the
 *  host's refusals and an older host's answer are final, so nothing here loops on its own. A text the
 *  phone already holds (a thumbnail read it) paints at once while the host is asked again. */
export function useMobileRecordedFile(
  source: MobileChatSurfaceRecordedSource | null,
  path: string
): { state: MobileRecordedFileState; retry: () => void } {
  // The source's identity is its client and session, not the object that carries them.
  const client = source?.client ?? null
  const sessionId = source?.sessionId ?? null
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<MobileRecordedFileState>(() => {
    const cached = source ? cachedRecordedFileContent(source, path) : null
    return cached === null ? { kind: 'loading' } : { kind: 'ready', content: cached }
  })

  useEffect(() => {
    if (!client || sessionId === null) {
      return
    }
    const target = { client, sessionId }
    let cancelled = false
    if (cachedRecordedFileContent(target, path) === null) {
      setState({ kind: 'loading' })
    }
    void readMobileRecordedFile(target, path).then((read) => {
      if (cancelled) {
        return
      }
      if (read.kind === 'ready') {
        rememberRecordedFileContent(target, path, read.content)
      }
      setState(read)
    })
    return () => {
      cancelled = true
    }
  }, [client, sessionId, path, attempt])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])
  return { state, retry }
}
