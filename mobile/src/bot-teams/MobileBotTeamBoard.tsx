import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type {
  BotTeamProject,
  BotTeamTask
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { MobileBotTeamTaskCard } from './MobileBotTeamTaskCard'
import { MobileBotTeamWorkBar } from './MobileBotTeamWorkBar'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** The team's tasks, filtered by project: all of them, each project, then the tasks with none. */
export function MobileBotTeamBoard({
  client,
  team,
  tasks,
  projects,
  workspaceId,
  working,
  offline,
  onBack,
  onOpenTask
}: {
  client: RpcClient
  team: BotTeam
  tasks: readonly BotTeamTask[]
  projects: readonly BotTeamProject[]
  workspaceId: string | null
  working: boolean
  offline: boolean
  onBack: () => void
  onOpenTask: (workspaceId: string, task: BotTeamTask) => void
}) {
  const [filter, setFilter] = useState('all')
  const chips = [
    { id: 'all', name: `All ${tasks.length}` },
    ...projects.map((project) => ({
      id: `project:${project.id}`,
      name: `${project.name} ${tasks.filter((task) => task.projectId === project.id).length}`
    })),
    { id: 'none', name: `No project ${tasks.filter((task) => task.projectId === null).length}` }
  ]
  const shown = tasks.filter((task) => {
    if (filter === 'all') {
      return true
    }
    return filter === 'none'
      ? task.projectId === null
      : task.projectId !== null && `project:${task.projectId}` === filter
  })
  const projectName = (task: BotTeamTask) =>
    projects.find((project) => project.id === task.projectId)?.name ?? null

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
        <View style={styles.chips}>
          {chips.map((chip) => (
            <Pressable
              key={chip.id}
              accessibilityRole="button"
              onPress={() => setFilter(chip.id)}
              style={[styles.chip, filter === chip.id && styles.rowSelected]}
            >
              <Text style={styles.rowTitle}>{chip.name}</Text>
            </Pressable>
          ))}
        </View>
        {shown.length === 0 ? <Text style={styles.message}>No tasks here.</Text> : null}
        {shown.map((task) => (
          <MobileBotTeamTaskCard
            key={task.id}
            client={client}
            task={task}
            team={team}
            offline={offline}
            projectName={projectName(task)}
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
