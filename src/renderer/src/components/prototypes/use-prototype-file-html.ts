import { useEffect, useState } from 'react'
import { readPrototypeSetFileOnHost } from '../../runtime/runtime-prototype-client'

const LOCAL_RUNTIME = { kind: 'local' } as const

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
    void readPrototypeSetFileOnHost(LOCAL_RUNTIME, { sessionId, requestId, fileName })
      .then((result) => {
        if (active) {
          setState(result.ok ? { status: 'ready', html: result.html } : { status: 'error' })
        }
      })
      .catch(() => {
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
