import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import {
  mobileRoutineRunStatus,
  mobileRoutineScheduleLine,
  mobileRoutineWhenLabel
} from './MobileBotTeamRoutineLabels'
import { listMobileBotTeamRoutineRuns } from './MobileBotTeamRoutineRpc'
import { MobileBotTeamRoutineSwitch, useMobileBotTeamRoutines } from './MobileBotTeamRoutines'
import { MobileBotTeamWorkBar } from './MobileBotTeamWorkBar'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { useMobileBotTeamRoom } from './use-mobile-bot-team-room'
import { useMobileBotTeamTaskStatus } from './use-mobile-bot-team-task-status'

type RunsRead = Awaited<ReturnType<typeof listMobileBotTeamRoutineRuns>>

function dotColor(status: string | null): string {
  if (status === 'Working' || status === 'Done') {
    return colors.statusGreen
  }
  return status === 'Waiting for you' ? colors.statusAmber : colors.textMuted
}

/** One routine (M39): how it runs, the switch, and every run with its task. */
export function MobileBotTeamRoutineRuns({
  client,
  team,
  routineId,
  offline,
  onBack,
  onOpenTask
}: {
  client: RpcClient
  team: BotTeam
  routineId: string
  offline: boolean
  onBack: () => void
  onOpenTask: (workspaceId: string, task: BotTeamTask) => void
}) {
  const { read, replace } = useMobileBotTeamRoutines(client, team.id, offline)
  const { room } = useMobileBotTeamRoom(client, team.id, offline)
  const statusOf = useMobileBotTeamTaskStatus(client)
  const [runs, setRuns] = useState<RunsRead | null>(null)
  useEffect(() => {
    if (offline) {
      return
    }
    let current = true
    void listMobileBotTeamRoutineRuns(client, routineId).then((next) => {
      if (current) {
        setRuns(next)
      }
    })
    return () => {
      current = false
    }
  }, [client, routineId, offline])

  const routine =
    read?.kind === 'ready' ? read.value.find((entry) => entry.id === routineId) : undefined
  const bot = team.bots.find((entry) => entry.id === routine?.botId)
  const workspaceId = room?.workspaceId ?? null
  return (
    <View style={styles.grow}>
      <MobileBotTeamWorkBar title={routine?.name ?? 'Routine'} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.form}>
        {routine ? (
          <>
            <MobileBotTeamRoutineSwitch
              client={client}
              routine={routine}
              offline={offline}
              onChanged={replace}
            />
            <Text style={styles.rowMeta}>{routine.prompt}</Text>
            <View style={styles.taskCard}>
              <Text style={styles.rowTitle}>{mobileRoutineScheduleLine(routine.schedule)}</Text>
              <Text style={styles.rowMeta}>
                {`${bot?.name ?? ''}. ${team.accessMode === 'full-access' ? 'Full access' : 'Ask first'}, set for ${team.name}.`}
              </Text>
              <Text style={styles.rowMeta}>
                {routine.nextRun
                  ? `Next run ${mobileRoutineWhenLabel(routine.nextRun)}`
                  : 'Paused.'}
              </Text>
            </View>
          </>
        ) : null}
        <Text style={styles.label}>Runs</Text>
        {runs?.kind === 'unsupported' ? (
          <Text style={styles.message}>This host cannot run routines yet.</Text>
        ) : null}
        {offline || runs?.kind === 'failed' ? (
          <Text style={styles.message}>Check the connection to this host and try again.</Text>
        ) : null}
        {runs?.kind === 'ready' && runs.value.length === 0 ? (
          <Text style={styles.message}>It has not run yet.</Text>
        ) : null}
        {runs?.kind === 'ready'
          ? runs.value.map((run) => {
              const task = room?.tasks.find((entry) => entry.id === run.taskId)
              const status = mobileRoutineRunStatus(run, task, statusOf)
              return (
                <View key={run.id} style={styles.taskCard}>
                  <View style={styles.taskCardStatus}>
                    <View style={[styles.statusDot, { backgroundColor: dotColor(status) }]} />
                    <Text style={[styles.rowTitle, styles.grow]}>
                      {mobileRoutineWhenLabel(run.scheduledFor)}
                    </Text>
                    {status ? <Text style={styles.rowMeta}>{status}</Text> : null}
                  </View>
                  <Text style={styles.rowMeta}>
                    {run.error ?? (task ? `Made the task “${task.title}”.` : 'Made a task.')}
                  </Text>
                  {task && workspaceId !== null && task.sessionId !== null ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open task ${task.title}`}
                      disabled={offline}
                      onPress={() => onOpenTask(workspaceId, task)}
                      style={styles.secondary}
                    >
                      <Text style={styles.rowTitle}>Open task</Text>
                    </Pressable>
                  ) : null}
                </View>
              )
            })
          : null}
        <Text style={styles.rowMeta}>{`Each run creates one task in ${team.name}’s board.`}</Text>
      </ScrollView>
    </View>
  )
}
