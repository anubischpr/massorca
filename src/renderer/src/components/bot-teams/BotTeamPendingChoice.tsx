import { useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { fileBotTeamRequest, type BotTeamRequestFiling } from '@/runtime/runtime-bot-team-client'
import type { BotTeamPrototypeChoice } from '../../../../shared/bot-team-prototype-choice'
import type { BotTeamRequestChoice } from '../../../../shared/bot-team-request-choice'
import type { BotTeamRoomAttachment } from '../../../../shared/bot-team-room-attachments'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../../../../shared/rpc-contract/bot-team-room-params'
import { BotTeamProjectQuestion } from './BotTeamProjectQuestion'
import { BotTeamRequestChoiceCard } from './BotTeamRequestChoiceCard'

export type BotTeamPendingChoiceRequest = {
  choice: BotTeamRequestChoice
  text: string
  /** The person asked for the work later: filed in Todo, never started. */
  later?: boolean
  /** The files the person attached to the request; they stay with it until it is filed. */
  attachments?: BotTeamRoomAttachment[]
  /** The count the person chose on the prototype card; the filed task keeps it. */
  prototypeChoice?: BotTeamPrototypeChoice
}

/** Puts the room's question to the person and files the request where they decide. */
export function BotTeamPendingChoice({
  pending,
  team,
  otherTeams,
  projects,
  onFiled,
  onAsked,
  onCreateBot,
  onCreateTeam
}: {
  pending: BotTeamPendingChoiceRequest
  team: BotTeam
  otherTeams: readonly BotTeam[]
  projects: readonly BotTeamProject[]
  /** The request was filed; the room reads itself again and drops the question. */
  onFiled: () => void
  /** The host asks the next question before filing, the project one. */
  onAsked: (choice: BotTeamRequestChoice) => void
  onCreateBot: () => void
  onCreateTeam: () => void
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const file = async (
    target: Omit<BotTeamRequestFiling, 'teamId' | 'text' | 'start'>
  ): Promise<void> => {
    setBusy(true)
    try {
      const filed = await fileBotTeamRequest({
        teamId: team.id,
        text: pending.text,
        start: true,
        askProject: true,
        ...(pending.later ? { later: true } : {}),
        ...(pending.attachments?.length ? { attachments: pending.attachments } : {}),
        ...(pending.prototypeChoice ? { prototypeChoice: pending.prototypeChoice } : {}),
        ...target
      })
      if (filed.choice) {
        onAsked(filed.choice)
        return
      }
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
  if (pending.choice.kind === 'project') {
    const { botId, alsoNeeds } = pending.choice
    return (
      <BotTeamProjectQuestion
        projects={projects}
        busy={busy}
        onAnswer={(projectId) =>
          void file({ botId, projectId, ...(alsoNeeds ? { alsoNeeds } : {}) })
        }
      />
    )
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
