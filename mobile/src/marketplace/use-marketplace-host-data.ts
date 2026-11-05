import { useEffect, useState } from 'react'
import { loadHosts } from '../transport/host-store'
import type { HostProfile } from '../transport/types'
import type { CatalogSource } from './marketplace-catalog-model'
import {
  listMarketplaceApps,
  readHostAgentIds,
  readHostPiRuntimes,
  readHostTools,
  type MarketplaceHostRpc
} from './marketplace-host-rpc'

export type MarketplaceHostData = CatalogSource & {
  /** False until the first answer for the current host arrives. */
  loaded: boolean
  refresh: () => void
}

const UNLOADED: CatalogSource & { loaded: boolean } = {
  loaded: false,
  apps: null,
  tools: null,
  agentIds: null,
  piRuntimes: null
}

/** Reads the host's Marketplace state; a new client or a refresh re-reads everything. */
export function useMarketplaceHostData(
  client: MarketplaceHostRpc | null,
  connected: boolean
): MarketplaceHostData {
  const [snapshot, setSnapshot] = useState(UNLOADED)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (client === null || !connected) {
      return
    }
    let stale = false
    setSnapshot(UNLOADED)
    void Promise.all([
      listMarketplaceApps(client),
      readHostTools(client),
      readHostAgentIds(client),
      readHostPiRuntimes(client)
    ]).then(([apps, tools, agentIds, piRuntimes]) => {
      if (!stale) {
        setSnapshot({
          loaded: true,
          apps: apps.ok ? apps.apps : null,
          tools,
          agentIds,
          piRuntimes
        })
      }
    })
    return () => {
      stale = true
    }
  }, [client, connected, revision])

  return { ...snapshot, refresh: () => setRevision((count) => count + 1) }
}

/** The paired hosts, in the order the phone keeps them. */
export function useMarketplaceHostList(): HostProfile[] {
  const [hosts, setHosts] = useState<HostProfile[]>([])
  useEffect(() => {
    let stale = false
    loadHosts()
      .then((list) => {
        if (!stale) {
          setHosts(list)
        }
      })
      .catch(() => {
        if (!stale) {
          setHosts([])
        }
      })
    return () => {
      stale = true
    }
  }, [])
  return hosts
}

export function useMarketplaceHostName(hostId: string | undefined): string {
  const hosts = useMarketplaceHostList()
  return hosts.find((host) => host.id === hostId)?.name ?? ''
}
