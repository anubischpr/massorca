import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import {
  BOT_TEAM_BOARD_COLUMNS,
  botTeamBoardColumn,
  type BotTeamBoardColumn
} from '../../../src/shared/bot-team-board-column'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type {
  BotTeamProject,
  BotTeamTask
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import { spacing } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotTeamBrief } from './MobileBotTeamBrief'
import { MobileBotTeamConnectCode } from './MobileBotTeamConnectCode'
import { MobileBotTeamWorkspaceLink } from './MobileBotTeamProjectWorkspace'
import { MobileBotTeamTaskCard } from './MobileBotTeamTaskCard'
import { MobileBotTeamWorkBar } from './MobileBotTeamWorkBar'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { useMobileBotTeamTaskStatus } from './use-mobile-bot-team-task-status'

/** A project's board, with its Brief one tap away: the cards of its tasks by column. */
export function MobileBotTeamProject({
  client,
  team,
  teams,
  project,
  tasks,
  tab,
  offline,
  workspaceId,
  onBack,
  onTab,
  onOpenTask,
  onChanged
}: {
  client: RpcClient
  team: BotTeam
  teams: readonly BotTeam[]
  project: BotTeamProject
  tasks: readonly BotTeamTask[]
  tab: 'board' | 'brief'
  offline: boolean
  workspaceId: string | null
  onBack: () => void
  onTab: (tab: 'board' | 'brief') => void
  onOpenTask: (workspaceId: string, task: BotTeamTask) => void
  /** After a change to the project, so the host's state is read again. */
  onChanged: () => void
}) {
  const [column, setColumn] = useState<BotTeamBoardColumn>('In Progress')
  const statusOf = useMobileBotTeamTaskStatus(client)
  const columnOf = (task: BotTeamTask) => botTeamBoardColumn(statusOf(task))
  const projectTasks = tasks.filter((task) => task.projectId === project.id)
  const shown = projectTasks.filter((task) => columnOf(task) === column)

  return (
    <View style={styles.grow}>
      <MobileBotTeamWorkBar
        title={project.name}
        onBack={tab === 'brief' ? () => onTab('board') : onBack}
      />
      <View style={[styles.chips, { paddingHorizontal: spacing.lg }]}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'board' }}
          onPress={() => onTab('board')}
          style={[styles.chip, tab === 'board' && styles.rowSelected]}
        >
          <Text style={styles.rowTitle}>Board</Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'brief' }}
          onPress={() => onTab('brief')}
          style={[styles.chip, tab === 'brief' && styles.rowSelected]}
        >
          <Text style={styles.rowTitle}>Brief</Text>
        </Pressable>
      </View>
      {tab === 'brief' ? (
        <MobileBotTeamBrief project={project} />
      ) : (
        <ScrollView contentContainerStyle={styles.form}>
          {team.workspacesEnabled ? (
            <MobileBotTeamConnectCode
              client={client}
              project={project}
              offline={offline}
              onChanged={onChanged}
            />
          ) : null}
          {team.workspacesEnabled && project.codeSource === 'repo' ? (
            <MobileBotTeamWorkspaceLink
              client={client}
              teamId={team.id}
              project={project}
              offline={offline}
              onChanged={onChanged}
            />
          ) : null}
          <View style={styles.chips}>
            {BOT_TEAM_BOARD_COLUMNS.map((name) => (
              <Pressable
                key={name}
                accessibilityRole="button"
                onPress={() => setColumn(name)}
                style={[styles.chip, column === name && styles.rowSelected]}
              >
                <Text style={styles.rowTitle}>
                  {`${name} ${projectTasks.filter((task) => columnOf(task) === name).length}`}
                </Text>
              </Pressable>
            ))}
          </View>
          {shown.length === 0 ? (
            <Text style={styles.message}>Nothing in this column yet.</Text>
          ) : null}
          {shown.map((task) => (
            <MobileBotTeamTaskCard
              key={task.id}
              client={client}
              task={task}
              team={team}
              teams={teams}
              offline={offline}
              onReassigned={onChanged}
              onOpen={() => {
                if (workspaceId) {
                  onOpenTask(workspaceId, task)
                }
              }}
            />
          ))}
        </ScrollView>
      )}
    </View>
  )
}
