import { useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { postBotTeamRequest } from '@/runtime/runtime-bot-team-client'
import { useComposerDraft } from '@/lib/composer-draft'
import { useAppStore } from '@/store'
import { routeBotTeamRequest } from '../../../../shared/bot-team-request-route'
import { BotTeamCharacterIcon } from '../bot-teams/BotTeamCharacterIcon'
import { useBotTeams } from '../bot-teams/use-bot-teams'
import { CreateChatChipMenu } from '../create-chat/CreateChatChipMenu'
import { CreateChatComposer } from '../create-chat/CreateChatComposer'
import { CreateChatPageFrame } from '../create-chat/CreateChatPageFrame'

type TasksHomeBotTeamSessionProps = {
  /** The WorkSpaces / Bot Team switch, centered over the place row. */
  aboveComposer: ReactNode
  below: ReactNode
}

/**
 * The Tasks home's Bot Team mode: pick the team, write the task, and it goes through the same
 * request the team room sends. The host is the connected one, so SSH and paired hosts answer.
 */
export function TasksHomeBotTeamSession({
  aboveComposer,
  below
}: TasksHomeBotTeamSessionProps): React.JSX.Element {
  const openBotTeamsView = useAppStore((s) => s.openBotTeamsView)
  const { teams } = useBotTeams()
  const [pickedTeamId, setPickedTeamId] = useState<string | null>(null)
  // The canvas row offers Save to Todo, so a task waits there until the person starts it.
  const [startNow, setStartNow] = useState(false)
  const [draft, setDraft, clearDraft] = useComposerDraft('tasks:bot-team')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const team = teams?.find((candidate) => candidate.id === pickedTeamId) ?? teams?.[0] ?? null
  const canSubmit = !pending && team !== null && draft.trim() !== ''

  const submit = async (): Promise<void> => {
    if (!canSubmit || team === null || inFlight.current) {
      return
    }
    const text = draft.trim()
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
      clearDraft()
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
    <CreateChatPageFrame
      heading={translate('components.tasksHome.heading', 'What do you want to do?')}
      subheading={null}
      layout="top"
      aboveComposer={aboveComposer}
      below={below}
    >
      <CreateChatComposer
        draft={draft}
        onDraftChange={setDraft}
        canSubmit={canSubmit}
        pending={pending}
        error={error}
        onSubmit={submit}
        copy={{
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
        }}
        placeChips={
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
        }
        footerChips={null}
        notice={null}
        rightChips={null}
      />
    </CreateChatPageFrame>
  )
}
