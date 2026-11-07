import { marketplaceAppMention } from '../../shared/marketplace-app-mentions'
import {
  marketplaceAgentSupportsAppDenial,
  marketplaceAgentSwitchBlockedMessage
} from '../../shared/marketplace-apps'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import { deniedMarketplaceAppIdsForBot } from '../marketplace/marketplace-bot-run-denial'

/**
 * Refuses putting a bot on an agent that can't be kept out of a Marketplace app while the policy
 * blocks the bot from one. A bot already on that agent may still be edited. `botId` is empty for a
 * bot not added yet, so only team-wide rules can match it.
 */
export async function assertBotAgentSwitchAllowed(
  input: { teams: readonly BotTeam[]; teamId: string; botId: string; agent: string },
  denied: typeof deniedMarketplaceAppIdsForBot = deniedMarketplaceAppIdsForBot
): Promise<void> {
  if (marketplaceAgentSupportsAppDenial(input.agent)) {
    return
  }
  const current = input.teams
    .find((team) => team.id === input.teamId)
    ?.bots.find((bot) => bot.id === input.botId)
  if (current?.agent === input.agent) {
    return
  }
  const blocked = await denied({ botId: input.botId, teamId: input.teamId })
  if (blocked.length > 0) {
    throw new Error(
      marketplaceAgentSwitchBlockedMessage(blocked.map((id) => marketplaceAppMention(id).name))
    )
  }
}
