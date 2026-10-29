import { useCallback, useEffect, useRef, useState } from 'react'
import type { RpcClient } from '../transport/rpc-client'
import { worktreeCatalogRead } from '../worktree/worktree-catalog-operations'
import { worktreeAgentRowsFromCatalog, type WorktreeAgentRows } from './mobile-worktree-agent-rows'

/** The host's worktrees with their agent panes, read once per client and again on request. */
export function useWorktreeAgentRows(client: RpcClient | null): {
  worktrees: readonly WorktreeAgentRows[]
  refresh: () => void
} {
  const [worktrees, setWorktrees] = useState<readonly WorktreeAgentRows[]>([])
  const currentClientRef = useRef<RpcClient | null>(client)
  const inFlightClientRef = useRef<RpcClient | null>(null)
  const rereadRequestedRef = useRef(false)

  const refresh = useCallback(() => {
    if (!client) {
      return
    }
    if (inFlightClientRef.current === client) {
      // Why: a request made mid-read is answered by one more read, so the rows never stay stale.
      rereadRequestedRef.current = true
      return
    }
    const read = (): void => {
      inFlightClientRef.current = client
      rereadRequestedRef.current = false
      worktreeCatalogRead
        .request(client, { limit: 10000 })
        .then((reply) => {
          if (currentClientRef.current !== client) {
            return
          }
          const catalog = worktreeCatalogRead.interpret(reply)
          // Why: a refused read keeps the rows already known.
          if (catalog.accepted) {
            setWorktrees(worktreeAgentRowsFromCatalog(catalog.value.worktrees ?? []))
          }
        })
        .catch(() => {
          // Why: a failed read keeps the rows already known, so an Open control or nesting does not vanish on a blip.
        })
        .finally(() => {
          if (inFlightClientRef.current === client) {
            inFlightClientRef.current = null
          }
          if (rereadRequestedRef.current && currentClientRef.current === client) {
            read()
          }
        })
    }
    read()
  }, [client])

  useEffect(() => {
    currentClientRef.current = client
    refresh()
  }, [client, refresh])

  return { worktrees, refresh }
}
