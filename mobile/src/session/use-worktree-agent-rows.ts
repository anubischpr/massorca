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

  const refresh = useCallback(() => {
    if (!client || inFlightClientRef.current === client) {
      return
    }
    inFlightClientRef.current = client
    worktreeCatalogRead
      .request(client, { limit: 10000 })
      .then((reply) => {
        if (currentClientRef.current !== client) {
          return
        }
        const catalog = worktreeCatalogRead.interpret(reply)
        setWorktrees(
          worktreeAgentRowsFromCatalog(catalog.accepted ? (catalog.value.worktrees ?? []) : [])
        )
      })
      .catch(() => {
        // Why: a failed read keeps the rows already known, so an Open control or nesting does not vanish on a blip.
      })
      .finally(() => {
        if (inFlightClientRef.current === client) {
          inFlightClientRef.current = null
        }
      })
  }, [client])

  useEffect(() => {
    currentClientRef.current = client
    refresh()
  }, [client, refresh])

  return { worktrees, refresh }
}
