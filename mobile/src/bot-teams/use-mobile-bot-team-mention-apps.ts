import { useEffect, useState } from 'react'
import { MARKETPLACE_APP_IDS, type MarketplaceAppId } from '../../../src/shared/marketplace-apps'
import {
  marketplaceAppMention,
  type MarketplaceAppMention
} from '../../../src/shared/marketplace-app-mentions'
import { BotTeamConnectedAppsResult } from '../../../src/shared/rpc-contract/bot-team-connected-apps-params'
import type { RpcClient } from '../transport/rpc-client'

const READ_TIMEOUT_MS = 15_000
const NO_APPS: readonly MarketplaceAppMention[] = []

function isMarketplaceAppId(id: string): id is MarketplaceAppId {
  return MARKETPLACE_APP_IDS.some((known) => known === id)
}

/** The host's connected Marketplace apps the team may use; none when the host is older, offline or the read fails. */
export async function listMobileBotTeamConnectedApps(
  client: Pick<RpcClient, 'sendRequest'>,
  teamId: string
): Promise<MarketplaceAppMention[]> {
  try {
    const response = await client.sendRequest(
      'botTeams.connectedApps',
      { teamId },
      {
        timeoutMs: READ_TIMEOUT_MS
      }
    )
    if (!response.ok) {
      return []
    }
    const parsed = BotTeamConnectedAppsResult.safeParse(response.result)
    // Why: an id this phone does not know has no name of its own to insert, so it is left out.
    return parsed.success
      ? parsed.data.apps.flatMap((app) =>
          isMarketplaceAppId(app.id) ? [marketplaceAppMention(app.id)] : []
        )
      : []
  } catch {
    return []
  }
}

/** The apps the room's @ menu can name, read once per room. */
export function useBotTeamMentionApps(
  client: Pick<RpcClient, 'sendRequest'>,
  teamId: string,
  offline: boolean
): readonly MarketplaceAppMention[] {
  const [apps, setApps] = useState<readonly MarketplaceAppMention[]>(NO_APPS)
  useEffect(() => {
    if (offline) {
      return
    }
    let current = true
    void listMobileBotTeamConnectedApps(client, teamId).then((listed) => {
      if (current) {
        setApps(listed)
      }
    })
    return () => {
      current = false
    }
  }, [client, teamId, offline])
  return apps
}
