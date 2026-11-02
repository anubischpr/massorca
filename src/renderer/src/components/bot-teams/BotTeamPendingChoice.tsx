import { useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { assignBotTeamRequest } from '@/runtime/runtime-bot-team-routing-client'
import type { BotTeamRequestChoice } from '../../../../shared/bot-team-request-choice'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotTeamRequestChoiceCard } from './BotTeamRequestChoiceCard'

export type BotTeamPendingChoiceRequest = { choice: BotTeamRequestChoice; text: string }

/** Puts the room's question to the person and files the request where they decide. */
export function BotTeamPendingChoice({
  pending,
  team,
  otherTeams,
  onFiled,
  onCreateBot,
  onCreateTeam
}: {
  pending: BotTeamPendingChoiceRequest
  team: BotTeam
  otherTeams: readonly BotTeam[]
  /** The request was filed; the room reads itself again and drops the question. */
  onFiled: () => void
  onCreateBot: () => void
  onCreateTeam: () => void
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const file = async (target: { botId?: string; toTeamId?: string }): Promise<void> => {
    setBusy(true)
    try {
      const filed = await assignBotTeamRequest({
        teamId: team.id,
        text: pending.text,
        start: true,
        ...target
      })
      if (filed.startError) {
        toast.error(filed.startError)
      }
      const sentTo = otherTeams.find((other) => other.id === target.toTeamId)
      if (sentTo) {
        toast.success(
          translate('components.botTeams.sentToTeam', 'Sent to {{team}}', { team: sentTo.name })
        )
      }
      onFiled()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <BotTeamRequestChoiceCard
      choice={pending.choice}
      team={team}
      otherTeams={otherTeams}
      busy={busy}
      onSendToBot={(botId) => void file({ botId })}
      onSendToTeam={(toTeamId) => void file({ toTeamId })}
      onKeep={() => void file({})}
      onCreateBot={onCreateBot}
      onCreateTeam={onCreateTeam}
    />
  )
}
