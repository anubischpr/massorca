import { useEffect, useState } from 'react'
import { readMobilePrototypeFile } from '../session/mobile-prototype-host-rpc'
import type { RpcClient } from '../transport/rpc-client'

export type MobilePrototypeFileRef = { sessionId: string; requestId: string; fileName: string }

/** Loading is also what a host out of contact shows: losing contact is not an unreadable file. */
export type MobilePrototypeFileHtml =
  | { status: 'loading' }
  | { status: 'ready'; html: string }
  | { status: 'error' }

/** The HTML of one set file, read from the host; a new file name, or a new connection, reads again. */
export function useMobilePrototypeFile(
  client: RpcClient | null,
  file: MobilePrototypeFileRef | null
): MobilePrototypeFileHtml {
  const [state, setState] = useState<MobilePrototypeFileHtml>({ status: 'loading' })
  const sessionId = file?.sessionId
  const requestId = file?.requestId
  const fileName = file?.fileName
  useEffect(() => {
    if (sessionId === undefined || requestId === undefined || fileName === undefined) {
      setState({ status: 'error' })
      return
    }
    if (client === null) {
      // With no connection, the HTML of an earlier file must not stand in for this one.
      setState({ status: 'loading' })
      return
    }
    let active = true
    setState({ status: 'loading' })
    void readMobilePrototypeFile(client, { sessionId, requestId, fileName }).then(
      (read) => {
        if (!active) {
          return
        }
        if (read.kind === 'ready') {
          setState({ status: 'ready', html: read.html })
        } else if (read.kind !== 'unreachable') {
          setState({ status: 'error' })
        }
      },
      // A read that throws has failed. It is not a host out of contact, which keeps loading.
      () => {
        if (active) {
          setState({ status: 'error' })
        }
      }
    )
    return () => {
      active = false
    }
  }, [client, sessionId, requestId, fileName])
  return state
}
