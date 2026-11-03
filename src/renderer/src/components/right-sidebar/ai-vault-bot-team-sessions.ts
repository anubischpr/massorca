import { createContext, useContext } from 'react'
import type { AiVaultSession } from '../../../../shared/ai-vault-types'
import type {
  BotTeamSessionTeam,
  BotTeamSessionTeamMap
} from '../bot-teams/BotTeamSessionCharacter'

/** The team behind a history row, found through the session id its structured owner carries. */
export function botTeamForAiVaultSession(
  session: Pick<AiVaultSession, 'structuredSession'>,
  sessionTeams: BotTeamSessionTeamMap
): BotTeamSessionTeam | undefined {
  const ownerSessionId = session.structuredSession?.sessionId
  return ownerSessionId === undefined ? undefined : sessionTeams[ownerSessionId]
}

const BotTeamSessionTeamsContext = createContext<BotTeamSessionTeamMap>({})

/** Supplies the host's bot-team sessions to the history rows beneath it. */
export const BotTeamSessionTeamsProvider = BotTeamSessionTeamsContext.Provider

export function useAiVaultBotTeam(
  session: Pick<AiVaultSession, 'structuredSession'>
): BotTeamSessionTeam | undefined {
  return botTeamForAiVaultSession(session, useContext(BotTeamSessionTeamsContext))
}
