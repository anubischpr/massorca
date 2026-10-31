import { useCallback, useEffect, useRef, useState } from 'react'
import { ChildBringBackStatus } from './child-bring-back'

type ChildBringBackMethod =
  | 'orchestration.childBringBackStatus'
  | 'orchestration.childBringBack'
  | 'orchestration.childBringBackAbort'
  | 'orchestration.childBringBackResolve'

/** Calls the host; each client brings its own transport. */
export type ChildBringBackCall = (
  method: ChildBringBackMethod,
  params: { requestId: string }
) => Promise<unknown>

const POLL_MS = 10_000

const UNAVAILABLE: ChildBringBackStatus = { kind: 'unavailable' }

function pollsWhile(status: ChildBringBackStatus): boolean {
  // Conflicts and blocks clear outside this notice, in a terminal or Source Control.
  return (
    status.kind === 'conflicts' ||
    status.kind === 'running' ||
    (status.kind === 'ready' && status.block !== null)
  )
}

export type ChildBringBackController = {
  status: ChildBringBackStatus
  busy: boolean
  error: string | null
  bringBack: () => void
  abort: () => void
  resolve: () => void
}

/** The notice's view of the host's state. An older host rejects the call, which reads as unavailable. */
export function useChildBringBack(
  requestId: string,
  call: ChildBringBackCall | null
): ChildBringBackController {
  const [status, setStatus] = useState<ChildBringBackStatus>(UNAVAILABLE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const callRef = useRef(call)
  callRef.current = call
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const read = useCallback(async (): Promise<void> => {
    const current = callRef.current
    if (!current) {
      return
    }
    const next = await current('orchestration.childBringBackStatus', {
      requestId
    })
      .then((result) => ChildBringBackStatus.safeParse(result).data ?? UNAVAILABLE)
      .catch(() => UNAVAILABLE)
    if (mounted.current) {
      setStatus(next)
    }
  }, [requestId])

  const hasCall = call !== null
  useEffect(() => {
    if (hasCall) {
      void read()
    }
  }, [hasCall, read])

  const polling = pollsWhile(status)
  useEffect(() => {
    if (!polling) {
      return
    }
    const timer = setInterval(() => void read(), POLL_MS)
    return () => clearInterval(timer)
  }, [polling, read])

  const act = useCallback(
    (method: ChildBringBackMethod): void => {
      const current = callRef.current
      if (!current) {
        return
      }
      setBusy(true)
      setError(null)
      void current(method, { requestId })
        .catch((failure: unknown) => {
          if (mounted.current) {
            setError(failure instanceof Error ? failure.message : String(failure))
          }
        })
        .then(read)
        .finally(() => {
          if (mounted.current) {
            setBusy(false)
          }
        })
    },
    [read, requestId]
  )

  return {
    status,
    busy,
    error,
    bringBack: () => act('orchestration.childBringBack'),
    abort: () => act('orchestration.childBringBackAbort'),
    resolve: () => act('orchestration.childBringBackResolve')
  }
}
