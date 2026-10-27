import { useCallback, useEffect, useState } from 'react'
import type { MobileChatSurfaceRecordedSource } from './mobile-chat-surface-snapshot'
import { readMobileRecordedFile, type MobileRecordedFileRead } from './mobile-recorded-file-read'

export type MobileRecordedFileState = { kind: 'loading' } | MobileRecordedFileRead

/** One recorded file, read once per host, session and path. Only a manual `retry` asks again: the
 *  host's refusals and an older host's answer are final, so nothing here loops on its own. */
export function useMobileRecordedFile(
  source: MobileChatSurfaceRecordedSource | null,
  path: string
): { state: MobileRecordedFileState; retry: () => void } {
  // The source's identity is its client and session, not the object that carries them.
  const client = source?.client ?? null
  const sessionId = source?.sessionId ?? null
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<MobileRecordedFileState>({ kind: 'loading' })

  useEffect(() => {
    if (!client || sessionId === null) {
      return
    }
    let cancelled = false
    setState({ kind: 'loading' })
    void readMobileRecordedFile({ client, sessionId }, path).then((read) => {
      if (!cancelled) {
        setState(read)
      }
    })
    return () => {
      cancelled = true
    }
  }, [client, sessionId, path, attempt])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])
  return { state, retry }
}
