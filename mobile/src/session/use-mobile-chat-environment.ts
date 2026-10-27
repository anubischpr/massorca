import { useEffect, useState } from 'react'
import type { RpcClient } from '../transport/rpc-client'
import {
  readMobileChatEnvironment,
  type MobileChatEnvironment
} from './mobile-chat-environment-read'

export type MobileChatEnvironmentState =
  | { kind: 'loading' }
  /** `environment` is null when the host answered but does not list this worktree. */
  | { kind: 'ready'; environment: MobileChatEnvironment | null }
  | { kind: 'unavailable' }

/** One worktree's environment, read once per client and worktree. A failed read is `unavailable`;
 *  the Summary keeps its other sections rather than failing with it. */
export function useMobileChatEnvironment(
  client: RpcClient | null,
  worktreeId: string
): MobileChatEnvironmentState {
  const [state, setState] = useState<MobileChatEnvironmentState>({ kind: 'loading' })

  useEffect(() => {
    if (!client) {
      return
    }
    let cancelled = false
    readMobileChatEnvironment(client, worktreeId).then(
      (environment) => {
        if (!cancelled) {
          setState({ kind: 'ready', environment })
        }
      },
      () => {
        if (!cancelled) {
          setState({ kind: 'unavailable' })
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [client, worktreeId])

  return state
}
