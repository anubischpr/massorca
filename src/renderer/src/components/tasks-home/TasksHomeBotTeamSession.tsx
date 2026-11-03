import { useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { postBotTeamRequest } from '@/runtime/runtime-bot-team-client'
import { useAppStore } from '@/store'
import { routeBotTeamRequest } from '../../../../shared/bot-team-request-route'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotTeamCharacterIcon } from '../bot-teams/BotTeamCharacterIcon'
import { useBotTeamMentionProjects } from '../bot-teams/bot-team-mention-projects'
import { useBotTeams } from '../bot-teams/use-bot-teams'
import { useBotTeamMentionField } from '../bot-teams/use-bot-team-mention-field'
import { useTeamWork } from '../bot-teams/use-bot-team-work'
import { CreateChatChipMenu } from '../create-chat/CreateChatChipMenu'
import { CreateChatComposer, type CreateChatComposerCopy } from '../create-chat/CreateChatComposer'
import { CreateChatPageFrame } from '../create-chat/CreateChatPageFrame'

type TasksHomeBotTeamSessionProps = {
  /** The WorkSpaces / Bot Team switch, centered over the place row. */
  aboveComposer: ReactNode
  below: ReactNode
}

function composerCopy(): CreateChatComposerCopy {
  return {
    placeholder: translate(
      'components.tasksHome.botTeamPlaceholder',
      'Describe the task for the team…'
    ),
    placeAria: translate('components.tasksHome.botTeamPlaceAria', 'Where it goes'),
    sendAria: translate('components.tasksHome.botTeamSendAria', 'Create task'),
    creatingAria: translate('components.tasksHome.botTeamCreatingAria', 'Creating task'),
    creating: translate('components.tasksHome.botTeamCreating', 'Creating task…'),
    hint: translate(
      'components.tasksHome.botTeamHint',
      'Enter to create the task · Shift+Enter for a new line'
    )
  }
}

/**
 * The Tasks home's Bot Team mode: pick the team, write the task, and it goes through the same
 * request the team room sends. The host is the connected one, so SSH and paired hosts answer.
 */
export function TasksHomeBotTeamSession({
  aboveComposer,
  below
}: TasksHomeBotTeamSessionProps): React.JSX.Element {
  const { teams } = useBotTeams()
  const [pickedTeamId, setPickedTeamId] = useState<string | null>(null)
  // The canvas row offers Save to Todo, so a task waits there until the person starts it.
  const [startNow, setStartNow] = useState(false)
  const team = teams?.find((candidate) => candidate.id === pickedTeamId) ?? teams?.[0] ?? null

  const placeChips = (
    <>
      <CreateChatChipMenu
        ariaLabel={translate('components.tasksHome.teamAria', 'Team')}
        label={team?.name ?? translate('components.tasksHome.teamChoose', 'Choose a team')}
        icon={team ? <BotTeamCharacterIcon character={team.character} size={14} /> : null}
        note={
          teams !== null && teams.length === 0
            ? translate(
                'components.botTeams.empty',
                'No teams yet. Create one to give your bots a place to work.'
              )
            : undefined
        }
        disabled={teams === null}
        groups={[
          {
            key: 'team',
            value: team?.id ?? '',
            items: (teams ?? []).map((candidate) => ({
              value: candidate.id,
              label: candidate.name,
              icon: <BotTeamCharacterIcon character={candidate.character} size={16} />
            })),
            onValueChange: setPickedTeamId
          }
        ]}
      />
      <CreateChatChipMenu
        ariaLabel={translate('components.tasksHome.startAria', 'When the task starts')}
        label={
          startNow
            ? translate('components.tasksHome.startNow', 'Start now')
            : translate('components.botTeams.saveToTodo', 'Save to Todo')
        }
        icon={null}
        groups={[
          {
            key: 'start',
            value: startNow ? 'start' : 'todo',
            items: [
              {
                value: 'todo',
                label: translate('components.botTeams.saveToTodo', 'Save to Todo')
              },
              {
                value: 'start',
                label: translate('components.tasksHome.startNow', 'Start now')
              }
            ],
            onValueChange: (value) => setStartNow(value === 'start')
          }
        ]}
      />
    </>
  )

  return (
    <CreateChatPageFrame
      heading={translate('components.tasksHome.heading', 'What do you want to do?')}
      subheading={null}
      layout="top"
      aboveComposer={aboveComposer}
      below={below}
    >
      {team ? (
        <TeamComposer
          team={team}
          otherTeams={(teams ?? []).filter((entry) => entry.id !== team.id)}
          startNow={startNow}
          placeChips={placeChips}
        />
      ) : (
        <CreateChatComposer
          draft=""
          onDraftChange={() => {}}
          canSubmit={false}
          pending={false}
          error={null}
          onSubmit={() => {}}
          copy={composerCopy()}
          placeChips={placeChips}
          footerChips={null}
          notice={null}
          rightChips={null}
        />
      )}
    </CreateChatPageFrame>
  )
}

/** The picked team's box: the conference room's field and @ menu, so it names the same bots, projects and files. */
function TeamComposer({
  team,
  otherTeams,
  startNow,
  placeChips
}: {
  team: BotTeam
  otherTeams: readonly BotTeam[]
  startNow: boolean
  placeChips: ReactNode
}): React.JSX.Element {
  const openBotTeamsView = useAppStore((s) => s.openBotTeamsView)
  const projects = useBotTeamMentionProjects(useTeamWork(team.id).projects)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const copy = composerCopy()
  const field = useBotTeamMentionField({
    team,
    otherTeams,
    projects,
    offline: false,
    menuPlacement: 'below',
    ariaLabel: copy.placeholder,
    placeholder: copy.placeholder,
    send: () => void submit()
  })
  const canSubmit = !pending && field.text.trim() !== ''

  // Hoisted: the field's Enter calls it.
  async function submit(): Promise<void> {
    if (!canSubmit || inFlight.current) {
      return
    }
    const text = field.text.trim()
    // Why: the host posts the message even when no bot takes it, so ask before sending.
    if (routeBotTeamRequest(text, team.bots) === null) {
      setError(
        translate(
          'components.botTeams.whoTakesIt',
          'Who should take this? Mention a bot with @ and its name.'
        )
      )
      return
    }
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      const sent = await postBotTeamRequest({ teamId: team.id, text, start: startNow })
      if (sent.startError) {
        toast.error(sent.startError)
      }
      openBotTeamsView({
        teamId: team.id,
        taskId: sent.task?.sessionId ? sent.task.id : null
      })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <CreateChatComposer
      draft={field.text}
      onDraftChange={() => {}}
      canSubmit={canSubmit}
      pending={pending}
      error={error}
      onSubmit={() => void submit()}
      copy={copy}
      editorField={{ render: field.field, menu: field.menu, containerRef: field.containerRef }}
      placeChips={placeChips}
      footerChips={null}
      notice={null}
      rightChips={null}
    />
  )
}
