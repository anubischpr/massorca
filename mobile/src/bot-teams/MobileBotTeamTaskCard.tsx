import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { botTeamStatusAwaiting } from '../../../src/shared/bot-team-task-status'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import { MobileBotTeamReassignSheet } from './MobileBotTeamReassignSheet'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { useMobileBotTeamTaskStatus } from './use-mobile-bot-team-task-status'

// Only a task nobody is working on can change hands, as on the desktop.
const REASSIGNABLE: ReadonlySet<string> = new Set(['Not started', 'Stopped', 'Stuck'])

function statusDotColor(status: string): string {
  if (status === 'Working' || status === 'Done') {
    return colors.statusGreen
  }
  return status === 'Waiting for you' ? colors.statusOrange : colors.textMuted
}

/** A task's owner, project and status; it opens in its workspace, and only the room starts it. */
export function MobileBotTeamTaskCard({
  client,
  task,
  team,
  teams,
  offline,
  projectName = null,
  onStart,
  onOpen,
  onReassigned
}: {
  client: RpcClient
  task: BotTeamTask
  team: BotTeam
  /** Every team: a task that is idle can be handed to any bot of any of them. */
  teams?: readonly BotTeam[]
  offline: boolean
  /** Shown on a board that spans projects; the room leaves it out. */
  projectName?: string | null
  onStart?: () => void
  onOpen: () => void
  onReassigned?: () => void
}) {
  const owner = team.bots.find((bot) => bot.id === task.ownerBotId)
  const statusOf = useMobileBotTeamTaskStatus(client)
  // A bot that ended its turn on a question for the person has not finished: the card waits for them.
  const status = botTeamStatusAwaiting(statusOf(task), task.awaitingPerson)
  const [reassigning, setReassigning] = useState(false)
  return (
    <View
      style={[
        styles.taskCard,
        status === 'Waiting for you' && { borderColor: colors.statusOrange }
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${task.title}`}
        accessibilityState={{ disabled: offline || task.sessionId === null }}
        disabled={offline || task.sessionId === null}
        onPress={onOpen}
        style={styles.taskCardBody}
      >
        <View style={styles.taskCardTitle}>
          {owner ? <MobileBotAgentIcon agentId={owner.agent} size={14} /> : null}
          <Text style={styles.rowTitle} numberOfLines={2}>
            {task.title}
          </Text>
        </View>
        {owner ? <Text style={styles.rowMeta}>{owner.name}</Text> : null}
        {projectName ? <Text style={styles.rowMeta}>{projectName}</Text> : null}
        <View style={styles.taskCardStatus}>
          {status === 'Unknown' ? (
            <View
              accessibilityLabel="Checking status"
              style={{
                width: 56,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.borderSubtle
              }}
            />
          ) : (
            <>
              <View style={[styles.statusDot, { backgroundColor: statusDotColor(status) }]} />
              <Text style={styles.rowMeta}>
                {status}
                {offline && task.sessionId !== null ? ', can’t confirm now' : ''}
              </Text>
            </>
          )}
        </View>
      </Pressable>
      {task.sessionId === null && onStart ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Start ${task.title}`}
          accessibilityState={{ disabled: offline }}
          disabled={offline}
          onPress={onStart}
          style={styles.secondary}
        >
          <Text style={styles.rowTitle}>Start</Text>
        </Pressable>
      ) : null}
      {teams && REASSIGNABLE.has(status) ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Reassign ${task.title}`}
            accessibilityState={{ disabled: offline }}
            disabled={offline}
            onPress={() => setReassigning(true)}
            style={styles.secondary}
          >
            <Text style={styles.rowTitle}>Reassign</Text>
          </Pressable>
          <MobileBotTeamReassignSheet
            client={client}
            task={task}
            teams={teams}
            visible={reassigning}
            onClose={() => setReassigning(false)}
            onDone={() => onReassigned?.()}
          />
        </>
      ) : null}
    </View>
  )
}
