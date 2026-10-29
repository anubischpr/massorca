import { useEffect, useState } from 'react'
import type { PiRuntimeSelection } from '../../../src/shared/pi-runtime-selection'
import { callAgentSession } from '../session/mobile-structured-agent-session-rpc'
import type { RpcClient } from '../transport/rpc-client'
import { readPiRuntimeReport } from './create-session-agent-choices'

const PI_RUNTIME_REPORT_TIMEOUT_MS = 15_000

/** Sends one host RPC and resolves with its result, or rejects when the host refuses it. */
export type PiRuntimeRequest = (method: string, params: unknown) => Promise<unknown>

/**
 * The Pi runtimes a host runs, or null when it cannot say. An older host refuses the method, and a
 * refusal or a lost connection says nothing about Pi, so the Pi row stays.
 */
export async function readCreateSessionPiRuntimes(
  request: PiRuntimeRequest,
  connectionId: string | null
): Promise<PiRuntimeSelection[] | null> {
  try {
    const result =
      connectionId === null
        ? await request('preflight.detectPiRuntimes', undefined)
        : await request('preflight.detectRemotePiRuntimes', { connectionId })
    return readPiRuntimeReport(result)
  } catch {
    return null
  }
}

/** The Pi runtimes for a repo's host, asked once agent detection has found Pi there. */
export function useCreateSessionPiRuntimes(args: {
  client: RpcClient | null
  connectionId: string | null
  enabled: boolean
}): readonly PiRuntimeSelection[] | null {
  const { client, connectionId, enabled } = args
  const [report, setReport] = useState<{
    connectionId: string | null
    runtimes: PiRuntimeSelection[] | null
  } | null>(null)

  useEffect(() => {
    if (!client || !enabled) {
      return
    }
    const request: PiRuntimeRequest = (method, params) =>
      callAgentSession<unknown>(client, method, params, PI_RUNTIME_REPORT_TIMEOUT_MS)
    let stale = false
    void readCreateSessionPiRuntimes(request, connectionId).then((runtimes) => {
      if (!stale) {
        setReport({ connectionId, runtimes })
      }
    })
    return () => {
      stale = true
    }
  }, [client, connectionId, enabled])

  return report?.connectionId === connectionId ? report.runtimes : null
}
