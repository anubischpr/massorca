import { useCallback, useEffect, useState } from 'react'
import type { BaseRefSearchResult } from '../../../src/shared/repo-types'
import { repoDefaultBaseRefRead } from '../source-control/mobile-repo-base-ref-operations'
import { searchBranches } from '../tasks/smart-source-search-requests'
import type { RpcClient } from '../transport/rpc-client'

export type CreateSessionBaseRefSource = {
  /** What the host starts a new worktree from when nothing is picked; null while unknown. */
  defaultRef: string | null
  /** The first page of the listing. `failed` leaves the default in place and the chip read-only. */
  listing: 'loading' | 'ready' | 'failed'
  initialRefs: readonly BaseRefSearchResult[]
  search: (query: string) => Promise<BaseRefSearchResult[]>
}

type Loaded = {
  key: string
  defaultRef: string | null
  listing: 'ready' | 'failed'
  refs: readonly BaseRefSearchResult[]
}

/**
 * The base-branch data of one project: the default the host uses, and the first page of its
 * branches. An older host or a failed read never blocks the create; it only makes the chip read-only.
 */
export function useCreateSessionBaseRef(
  client: RpcClient | null,
  repoId: string | null,
  active: boolean
): CreateSessionBaseRefSource {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const key = repoId && active ? repoId : null

  useEffect(() => {
    if (!client || !key) {
      return
    }
    let stale = false
    const defaultRead = repoDefaultBaseRefRead
      .request(client, { repo: `id:${key}` })
      .then((reply) => repoDefaultBaseRefRead.interpret(reply))
      .catch(() => null)
    const refsRead = searchBranches(client, key, '').then(
      (refs) => ({ listing: 'ready' as const, refs }),
      () => ({ listing: 'failed' as const, refs: [] })
    )
    void Promise.all([defaultRead, refsRead]).then(([defaultRef, found]) => {
      if (!stale) {
        setLoaded({ key, defaultRef, ...found })
      }
    })
    return () => {
      stale = true
    }
  }, [client, key])

  const search = useCallback(
    (query: string): Promise<BaseRefSearchResult[]> =>
      client && repoId ? searchBranches(client, repoId, query) : Promise.resolve([]),
    [client, repoId]
  )
  const current = loaded && loaded.key === key ? loaded : null
  return {
    defaultRef: current?.defaultRef ?? null,
    listing: current ? current.listing : 'loading',
    initialRefs: current?.refs ?? [],
    search
  }
}
