import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type {
  BotTeamProject,
  BotTeamTask
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import type { BotTeamRoutine } from '../../../src/shared/rpc-contract/bot-team-routine-params'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotTeamBoardProjectPicker } from './MobileBotTeamBoardProjectPicker'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { useMobileBotTeamRoutines } from './MobileBotTeamRoutines'
import { MobileBotTeamScheduledRows } from './MobileBotTeamScheduledRows'
import { MobileBotTeamTaskCard } from './MobileBotTeamTaskCard'
import { MobileBotTeamWorkBar } from './MobileBotTeamWorkBar'
import {
  BOARD_ALL_PROJECTS,
  BOARD_NO_PROJECT,
  BOARD_STATUS_FILTERS,
  type BoardStatusFilter,
  boardProjectFilterId,
  boardStatusMatches,
  boardTaskInProject
} from './mobile-bot-team-board-filter'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { useMobileBotTeamTaskStatus } from './use-mobile-bot-team-task-status'

const NO_ROUTINES: readonly BotTeamRoutine[] = []

/** The team's tasks: a status view (Active by default, as on the desktop) and one project at a time. */
export function MobileBotTeamBoard({
  client,
  team,
  teams,
  tasks,
  projects,
  workspaceId,
  working,
  offline,
  onBack,
  onOpenTask,
  onChanged
}: {
  client: RpcClient
  team: BotTeam
  teams: readonly BotTeam[]
  tasks: readonly BotTeamTask[]
  projects: readonly BotTeamProject[]
  workspaceId: string | null
  working: boolean
  offline: boolean
  onBack: () => void
  onOpenTask: (workspaceId: string, task: BotTeamTask) => void
  /** After a task changes hands, so the host's state is read again. */
  onChanged: () => void
}) {
  const [statusFilter, setStatusFilter] = useState<BoardStatusFilter>('Active')
  const [projectFilter, setProjectFilter] = useState(BOARD_ALL_PROJECTS)
  const statusOf = useMobileBotTeamTaskStatus(client)
  const { read } = useMobileBotTeamRoutines(client, team.id, offline)
  const routines = read?.kind === 'ready' ? read.value : NO_ROUTINES
  const statusTasks = tasks.filter((task) => boardStatusMatches(statusFilter, statusOf(task)))
  const projectOptions = [
    { id: BOARD_ALL_PROJECTS, name: 'All projects', count: statusTasks.length },
    ...projects.map((project) => ({
      id: boardProjectFilterId(project.id),
      name: project.name,
      count: statusTasks.filter((task) => task.projectId === project.id).length
    })),
    {
      id: BOARD_NO_PROJECT,
      name: 'No project',
      count: statusTasks.filter((task) => task.projectId === null).length
    }
  ]
  // A project that was removed while the board is open falls back to every project.
  const project = projectOptions.some((option) => option.id === projectFilter)
    ? projectFilter
    : BOARD_ALL_PROJECTS
  const shown = statusTasks.filter((task) => boardTaskInProject(task, project))
  const projectName = (task: BotTeamTask) =>
    projects.find((item) => item.id === task.projectId)?.name ?? null
  // A routine belongs to the team, not to a project, so it shows on the team's Active view only.
  const routinesShown =
    statusFilter === 'Active' && (project === BOARD_ALL_PROJECTS || project === BOARD_NO_PROJECT)

  return (
    <View style={styles.grow}>
      <MobileBotTeamWorkBar
        title={`Board, ${team.name}`}
        icon={
          <MobileBotTeamCharacterIcon
            character={team.character}
            size={28}
            working={working}
            unreachable={offline}
          />
        }
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.form}>
        <MobileBotTeamBoardProjectPicker
          options={projectOptions}
          value={project}
          onChange={setProjectFilter}
        />
        <View style={styles.chips}>
          {BOARD_STATUS_FILTERS.map((filter) => (
            <Pressable
              key={filter}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === statusFilter }}
              onPress={() => setStatusFilter(filter)}
              style={[styles.chip, filter === statusFilter && styles.rowSelected]}
            >
              <Text style={styles.rowTitle}>
                {`${filter} ${tasks.filter((task) => boardStatusMatches(filter, statusOf(task))).length}`}
              </Text>
            </Pressable>
          ))}
        </View>
        {routinesShown ? <MobileBotTeamScheduledRows routines={routines} /> : null}
        {shown.length === 0 ? (
          <Text style={styles.message}>{`No ${statusFilter.toLowerCase()} tasks`}</Text>
        ) : null}
        {shown.map((task) => (
          <MobileBotTeamTaskCard
            key={task.id}
            client={client}
            task={task}
            team={team}
            teams={teams}
            offline={offline}
            projectName={projectName(task)}
            onReassigned={onChanged}
            onOpen={() => {
              if (workspaceId) {
                onOpenTask(workspaceId, task)
              }
            }}
          />
        ))}
      </ScrollView>
    </View>
  )
}
