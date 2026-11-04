import { useEffect, useMemo } from 'react'
import { useAppStore } from '@/store'
import {
  marketplaceAppMention,
  marketplaceAppsUsableByTeam,
  type MarketplaceAppMention
} from '../../../../shared/marketplace-app-mentions'
import type { MarketplaceAppStatus } from '../../../../shared/marketplace-apps'

const NO_APPS: readonly MarketplaceAppMention[] = []

/** The team a room's @ menu belongs to: an app every one of its bots is kept out of is not offered. */
export type MarketplaceMentionTeam = { id: string; bots: readonly { id: string }[] }

/** The connected apps an @ menu offers; with a team, only those at least one of its bots may use. */
export function connectedMarketplaceAppMentions(
  apps: readonly MarketplaceAppStatus[],
  team?: MarketplaceMentionTeam
): MarketplaceAppMention[] {
  const connected = apps.filter((app) => app.connected)
  return (team ? marketplaceAppsUsableByTeam(connected, team) : connected).map((app) =>
    marketplaceAppMention(app.id)
  )
}

/** The connected Marketplace apps an @ menu offers; none where the bridge is missing, as in the web client. */
export function useConnectedMarketplaceApps(
  team?: MarketplaceMentionTeam
): readonly MarketplaceAppMention[] {
  // Why optional: a store without the Marketplace slice (a partial test store) offers no apps.
  const apps = useAppStore((s) => s.marketplaceApps) ?? null
  const refresh = useAppStore((s) => s.refreshMarketplaceApps) ?? null
  const loading = apps?.status === 'loading'
  useEffect(() => {
    if (loading) {
      void refresh?.()
    }
  }, [loading, refresh])
  const teamId = team?.id
  const bots = team?.bots
  return useMemo(
    () =>
      apps?.status === 'ready'
        ? connectedMarketplaceAppMentions(
            apps.apps,
            teamId && bots ? { id: teamId, bots } : undefined
          )
        : NO_APPS,
    [apps, teamId, bots]
  )
}
