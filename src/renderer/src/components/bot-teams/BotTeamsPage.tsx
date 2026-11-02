import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Plus } from 'lucide-react'
import { usePageTopBandTitleTarget } from '../../app-shell/page-top-band-slot'
import { Button } from '@/components/ui/button'
import StatusIndicator, { type Status } from '@/components/sidebar/StatusIndicator'
import { translate } from '@/i18n/i18n'
import {
  addBotToTeam,
  createBotTeam,
  deleteBotTeam,
  removeBotFromTeam,
  updateBotOnTeam,
  updateBotTeam
} from '@/runtime/runtime-bot-team-client'
import type { BotTeamsSelection } from '@/store/slices/ui/ui-slice-contract-core'
import type { BotTeamOverallStatus } from '../../../../shared/bot-team-overall-status'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotAgentIcon } from './BotAgentIcon'
import { BotTeamCharacterIcon } from './BotTeamCharacterIcon'
import { BotTeamHostPicker } from './BotTeamHostPicker'
import { BotTeamFiles } from './BotTeamFiles'
import { BotTeamProjectBrief, type BotTeamProjectTab } from './BotTeamProjectBrief'
import { BotTeamBoard, BotTeamProjectBoard, NewBotProjectForm } from './BotTeamProjectViews'
import { BotTeamMemory } from './BotTeamMemory'
import { BotTeamRoom } from './BotTeamRoom'
import { BotTeamRoutineNew } from './BotTeamRoutineNew'
import { BotTeamRoutineRuns } from './BotTeamRoutineRuns'
import { BotTeamRoutines } from './BotTeamRoutines'
import { NewBotTeamForm } from './NewBotTeamForm'
import { useBotTeamCardStatus } from './use-bot-team-card-status'
import { useBotTeams } from './use-bot-teams'

const TEAM_STATUS_GLYPH: Record<BotTeamOverallStatus, Status> = {
  'Waiting for you': 'permission',
  Working: 'working',
  'Nothing running': 'inactive'
}

/** The room's title sits in the one top bar when there is one, otherwise over the conversation. */
function BotTeamRoomTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  const target = usePageTopBandTitleTarget()
  return target ? (
    createPortal(
      <div className="flex min-w-0 flex-1 items-center gap-2 px-2 text-sm font-medium">
        {children}
      </div>,
      target
    )
  ) : (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4 text-sm font-medium">
      {children}
    </div>
  )
}

function TeamDetail({
  team,
  otherTeams,
  offline,
  selection,
  onSelect,
  onEditTeam
}: {
  team: BotTeam
  otherTeams: readonly BotTeam[]
  offline: boolean
  selection: BotTeamsPageSelection
  onSelect: (selection: BotTeamsPageSelection) => void
  onEditTeam: (teamId: string) => void
}): React.JSX.Element {
  const { taskId, section } = selection
  const toTeam = (next: Partial<BotTeamsPageSelection> = {}): void =>
    onSelect({ teamId: team.id, taskId: null, creating: false, ...next })
  const toRoom = (): void => toTeam()
  const onOpenTask = (openTaskId: string | null): void => toTeam({ taskId: openTaskId })
  // A task's thread is a full chat, so it takes the page rather than the team's column.
  if (taskId !== null) {
    return <BotTeamRoom team={team} openTaskId={taskId} onOpenTask={onOpenTask} offline={offline} />
  }
  if (section?.kind === 'board') {
    return <BotTeamBoard team={team} onBack={toRoom} onOpenTask={onOpenTask} />
  }
  if (section?.kind === 'files') {
    return <BotTeamFiles team={team} />
  }
  if (section?.kind === 'memory') {
    return <BotTeamMemory team={team} />
  }
  if (section?.kind === 'routines') {
    return (
      <BotTeamRoutines
        team={team}
        onNew={() => toTeam({ section: { kind: 'routine-new' } })}
        onOpen={(routineId) => toTeam({ section: { kind: 'routine', routineId } })}
      />
    )
  }
  if (section?.kind === 'routine-new') {
    const toRoutines = (): void => toTeam({ section: { kind: 'routines' } })
    return <BotTeamRoutineNew team={team} onBack={toRoutines} onCreated={toRoutines} />
  }
  if (section?.kind === 'routine') {
    return (
      <BotTeamRoutineRuns
        team={team}
        routineId={section.routineId}
        onBack={() => toTeam({ section: { kind: 'routines' } })}
        onOpenTask={onOpenTask}
      />
    )
  }
  if (section?.kind === 'new-project') {
    return (
      <NewBotProjectForm
        team={team}
        onCancel={toRoom}
        onCreated={(project) => toTeam({ section: { kind: 'project', projectId: project.id } })}
      />
    )
  }
  if (section?.kind === 'project') {
    const { projectId } = section
    const openTab = (tab: BotTeamProjectTab): void =>
      toTeam({ section: { kind: 'project', projectId, ...(tab === 'brief' ? { tab } : {}) } })
    return section.tab === 'brief' ? (
      <BotTeamProjectBrief
        team={team}
        projectId={projectId}
        onBack={() => openTab('board')}
        onTab={openTab}
      />
    ) : (
      <BotTeamProjectBoard
        team={team}
        projectId={projectId}
        onBack={toRoom}
        onTab={openTab}
        onOpenTask={onOpenTask}
      />
    )
  }
  return (
    <BotTeamRoom
      team={team}
      openTaskId={null}
      onOpenTask={onOpenTask}
      offline={offline}
      otherTeams={otherTeams}
      onCreateBot={() => onEditTeam(team.id)}
      onCreateTeam={() => onSelect({ teamId: null, taskId: null, creating: true })}
      header={
        <BotTeamRoomTitle>
          <span className="min-w-0 flex-1 truncate">
            {translate('components.botTeams.conferenceRoom', 'Conference room')}
          </span>
          <BotTeamCharacterIcon character={team.character} size={20} unreachable={offline} />
          <span className="truncate text-xs text-muted-foreground">{team.name}</span>
        </BotTeamRoomTitle>
      }
    />
  )
}

/** Losing contact says nothing about the bots, which run on the host: they may still be working. */
function HostUnreachableNotice({
  lastSeenAt,
  onRetry
}: {
  lastSeenAt: number | null
  onRetry: () => void
}): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-6 pt-4 text-sm">
      <p className="min-w-0 flex-1 text-muted-foreground">
        {lastSeenAt === null
          ? translate(
              'components.botTeams.hostUnreachable',
              'Can’t reach this host. Its bots may still be working.'
            )
          : translate(
              'components.botTeams.hostUnreachableSince',
              'Can’t reach this host. Its bots may still be working. Last update at {{time}}.',
              {
                time: new Date(lastSeenAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              }
            )}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {translate('components.botTeams.tryAgain', 'Try again')}
      </Button>
    </div>
  )
}

function teamStatusLabel(status: BotTeamOverallStatus): string {
  switch (status) {
    case 'Waiting for you':
      return translate('components.botTeams.waitingForYou', 'Waiting for you')
    case 'Working':
      return translate('components.botTeams.working', 'Working')
    case 'Nothing running':
      return translate('components.botTeams.nothingRunning', 'Nothing running')
  }
}

function TeamGrid({
  teams,
  offline,
  onNew,
  onOpen,
  onEdit
}: {
  teams: BotTeam[]
  /** Contact is lost: the bots may still be working, so no state is claimed. */
  offline: boolean
  onNew: () => void
  onOpen: (teamId: string) => void
  onEdit: (teamId: string) => void
}): React.JSX.Element {
  const statusOf = useBotTeamCardStatus(teams)
  return (
    <div className="flex w-full max-w-[1040px] flex-col gap-5 p-8">
      <div className="flex items-center gap-2">
        <h1 className="min-w-0 flex-1 text-xl font-semibold">
          {translate('components.botTeams.allTeams', 'All teams')}
        </h1>
        <BotTeamHostPicker />
        <Button variant="outline" size="sm" onClick={onNew}>
          <Plus className="size-3.5" />
          {translate('components.botTeams.newTeam', 'New team')}
        </Button>
      </div>
      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate(
            'components.botTeams.empty',
            'No teams yet. Create one to give your bots a place to work.'
          )}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {teams.map((team) => {
            const status = statusOf(team.id)
            return (
              <div key={team.id} className="relative">
                <button
                  type="button"
                  onClick={() => onOpen(team.id)}
                  className="flex h-full min-h-[148px] w-full flex-col gap-2.5 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted"
                >
                  <BotTeamCharacterIcon
                    character={team.character}
                    size={64}
                    working={status === 'Working'}
                    unreachable={offline}
                  />
                  <span className="truncate text-sm font-semibold">{team.name}</span>
                  <span className="flex-1 text-xs leading-normal text-muted-foreground">
                    {team.purpose}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {team.bots.map((bot) => (
                      <BotAgentIcon key={bot.id} agent={bot.agent} size={16} />
                    ))}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <StatusIndicator
                      status={offline ? 'inactive' : TEAM_STATUS_GLYPH[status]}
                      showTooltip={false}
                    />
                    {offline
                      ? translate('components.botTeams.cannotConfirmNow', 'Can’t confirm now')
                      : teamStatusLabel(status)}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-2 top-2"
                  aria-label={translate('components.botTeams.editTeam', 'Edit team')}
                  onClick={() => onEdit(team.id)}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** What the page shows: the open team, a task thread or section inside it, or the new team form. */
export type BotTeamsPageSelection = BotTeamsSelection

const NOTHING_OPEN: BotTeamsPageSelection = { teamId: null, taskId: null, creating: false }

/** With no `selection` the page keeps its own; the left sidebar passes one to share it. */
export default function BotTeamsPage({
  selection: controlled,
  onSelectionChange
}: {
  selection?: BotTeamsPageSelection
  onSelectionChange?: (selection: BotTeamsPageSelection) => void
} = {}): React.JSX.Element {
  const { teams, failed, lastSeenAt, reload, applyChange } = useBotTeams()
  const [own, setOwn] = useState<BotTeamsPageSelection>(NOTHING_OPEN)
  const selection = controlled ?? own
  const select = (next: BotTeamsPageSelection): void => {
    if (controlled === undefined) {
      setOwn(next)
    }
    onSelectionChange?.(next)
  }
  const openTeam = teams?.find((team) => team.id === selection.teamId)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const editingTeam = teams?.find((team) => team.id === editingTeamId)
  return (
    <div className="scrollbar-sleek h-full overflow-y-auto bg-chat-canvas">
      {failed && !selection.creating ? (
        <HostUnreachableNotice lastSeenAt={lastSeenAt} onRetry={reload} />
      ) : null}
      {/* Before the list: choosing another host in the form must not lose what was typed. */}
      {editingTeam ? (
        <NewBotTeamForm
          key={editingTeam.id}
          usedCharacters={[]}
          editing={{
            team: editingTeam,
            onSave: (input) => {
              void applyChange(() => updateBotTeam({ teamId: editingTeam.id, ...input })).then(
                (done) => done && setEditingTeamId(null)
              )
            },
            onAddBot: (bot) => void applyChange(() => addBotToTeam(editingTeam.id, bot)),
            onUpdateBot: (botId, bot) =>
              void applyChange(() => updateBotOnTeam(editingTeam.id, botId, bot)),
            onRemoveBot: (botId) =>
              void applyChange(() => removeBotFromTeam(editingTeam.id, botId)),
            onDelete: () => {
              void applyChange(() => deleteBotTeam(editingTeam.id)).then(
                (done) => done && setEditingTeamId(null)
              )
            }
          }}
          onCancel={() => setEditingTeamId(null)}
          onCreate={() => {}}
        />
      ) : selection.creating ? (
        <NewBotTeamForm
          usedCharacters={(teams ?? []).map((team) => team.character)}
          onCancel={() => select(NOTHING_OPEN)}
          onCreate={(input) => {
            void applyChange(() => createBotTeam(input)).then((done) => {
              if (done) {
                select(NOTHING_OPEN)
              }
            })
          }}
        />
      ) : teams === null ? null : openTeam ? (
        <TeamDetail
          team={openTeam}
          otherTeams={teams.filter((team) => team.id !== openTeam.id)}
          offline={failed}
          selection={selection}
          onSelect={select}
          onEditTeam={setEditingTeamId}
        />
      ) : (
        <TeamGrid
          teams={teams}
          offline={failed}
          onEdit={setEditingTeamId}
          onNew={() => select({ teamId: null, taskId: null, creating: true })}
          onOpen={(teamId) => select({ teamId, taskId: null, creating: false })}
        />
      )}
    </div>
  )
}
