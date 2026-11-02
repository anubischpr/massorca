import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../src/shared/rpc-contract/bot-team-room-params'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotTeamBoard } from './MobileBotTeamBoard'
import { MobileBotTeamFile, MobileBotTeamFiles } from './MobileBotTeamFiles'
import { MobileBotTeamNewProject } from './MobileBotTeamNewProject'
import { MobileBotTeamProject } from './MobileBotTeamProject'
import { MobileBotTeamWorkBar } from './MobileBotTeamWorkBar'
import { useMobileBotTeamRoom } from './use-mobile-bot-team-room'
import { useMobileBotTeamStatus } from './use-mobile-bot-team-status'

/** The screens a team's room menu opens: its board, a project, or a new project. */
export type BotTeamWorkScreen =
  | { name: 'board'; teamId: string }
  | { name: 'project'; teamId: string; projectId: string; tab: 'board' | 'brief' }
  | { name: 'newProject'; teamId: string }
  | { name: 'files'; teamId: string }
  | { name: 'file'; teamId: string; path: string }

const WORK_SCREEN_NAMES: readonly string[] = ['board', 'project', 'newProject', 'files', 'file']

/** True for the screens a room menu opens, so the screen file can hand them to this module. */
export function isBotTeamWorkScreen(screen: { name: string }): screen is BotTeamWorkScreen {
  return WORK_SCREEN_NAMES.includes(screen.name)
}

/** The room's work screens, reading the team's tasks and projects from the host. */
export function MobileBotTeamWork({
  client,
  team,
  teams,
  offline,
  screen,
  onOpenRoom,
  onOpen,
  onOpenTask
}: {
  client: RpcClient
  team: BotTeam
  teams: readonly BotTeam[]
  offline: boolean
  screen: BotTeamWorkScreen
  onOpenRoom: () => void
  onOpen: (screen: BotTeamWorkScreen) => void
  onOpenTask: (workspaceId: string, task: BotTeamTask) => void
}) {
  const { room, reload } = useMobileBotTeamRoom(client, team.id, offline)
  const statusOf = useMobileBotTeamStatus(client, teams)
  const working = statusOf(team.id) === 'Working'
  const tasks = room?.tasks ?? []
  const projects = room?.projects ?? []
  const workspaceId = room?.workspaceId ?? null

  if (screen.name === 'board') {
    return (
      <MobileBotTeamBoard
        client={client}
        team={team}
        teams={teams}
        onChanged={() => void reload()}
        tasks={tasks}
        projects={projects}
        workspaceId={workspaceId}
        working={working}
        offline={offline}
        onBack={onOpenRoom}
        onOpenTask={onOpenTask}
      />
    )
  }
  if (screen.name === 'newProject') {
    return (
      <MobileBotTeamNewProject
        client={client}
        team={team}
        offline={offline}
        onCancel={onOpenRoom}
        onCreated={(project) => {
          void reload()
          onOpen({ name: 'project', teamId: team.id, projectId: project.id, tab: 'board' })
        }}
      />
    )
  }
  if (screen.name === 'files') {
    return (
      <MobileBotTeamFiles
        client={client}
        workspaceId={workspaceId}
        offline={offline}
        onBack={onOpenRoom}
        onOpenFile={(path) => onOpen({ name: 'file', teamId: team.id, path })}
      />
    )
  }
  if (screen.name === 'file') {
    return (
      <MobileBotTeamFile
        client={client}
        workspaceId={workspaceId}
        path={screen.path}
        onBack={() => onOpen({ name: 'files', teamId: team.id })}
      />
    )
  }
  const project = projects.find((entry) => entry.id === screen.projectId)
  if (!project) {
    return <MobileBotTeamWorkBar title={team.name} onBack={onOpenRoom} />
  }
  return (
    <MobileBotTeamProject
      client={client}
      team={team}
      teams={teams}
      project={project}
      tasks={tasks}
      tab={screen.tab}
      offline={offline}
      workspaceId={workspaceId}
      onBack={onOpenRoom}
      onTab={(tab) => onOpen({ ...screen, tab })}
      onOpenTask={onOpenTask}
      onChanged={() => void reload()}
    />
  )
}
