import { useEffect, useState } from 'react'
import { readPrototypeSetFileOnHost } from '../../runtime/runtime-prototype-client'
import { prototypeTargetForSession } from './prototype-host-targets'

export type PrototypeFileHtml =
  | { status: 'loading' }
  | { status: 'ready'; html: string }
  | { status: 'error' }

/** The HTML of one set file, read from the host; a new file name reads again. */
export function usePrototypeFileHtml(
  file: { sessionId: string; requestId: string; fileName: string } | null
): PrototypeFileHtml {
  const [state, setState] = useState<PrototypeFileHtml>({ status: 'loading' })
  const sessionId = file?.sessionId
  const requestId = file?.requestId
  const fileName = file?.fileName
  useEffect(() => {
    if (sessionId === undefined || requestId === undefined || fileName === undefined) {
      setState({ status: 'error' })
      return
    }
    let active = true
    setState({ status: 'loading' })
    void readPrototypeSetFileOnHost(prototypeTargetForSession(sessionId), {
      sessionId,
      requestId,
      fileName
    })
      .then((result) => {
        if (active) {
          if (!result.ok) {
            console.warn(`[prototypes] read refused for chat ${sessionId}: ${result.error}`)
          }
          setState(result.ok ? { status: 'ready', html: result.html } : { status: 'error' })
        }
      })
      .catch((error: unknown) => {
        console.warn(`[prototypes] read failed for chat ${sessionId}: ${String(error)}`)
        if (active) {
          setState({ status: 'error' })
        }
      })
    return () => {
      active = false
    }
  }, [sessionId, requestId, fileName])
  return state
}
