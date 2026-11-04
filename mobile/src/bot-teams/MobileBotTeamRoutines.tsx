import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { ChevronDown, ChevronRight } from 'lucide-react-native'
import { isArchivedBotTeamRoutine } from '../../../src/shared/bot-team-routine-archive'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamRoutine } from '../../../src/shared/rpc-contract/bot-team-routine-params'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import {
  askDeleteMobileBotTeamRoutine,
  MobileBotTeamRoutineSheet
} from './MobileBotTeamRoutineSheet'
import { listMobileBotTeamRoutines, setMobileBotTeamRoutinePaused } from './MobileBotTeamRoutineRpc'
import {
  mobileRoutineRunStatus,
  mobileRoutineRunsLine,
  mobileRoutineScheduleLine
} from './MobileBotTeamRoutineLabels'
import { MobileBotTeamWebhookRows } from './MobileBotTeamWebhookRows'
import { MobileBotTeamWorkBar } from './MobileBotTeamWorkBar'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { useMobileBotTeamRoom } from './use-mobile-bot-team-room'
import { useMobileBotTeamTaskStatus } from './use-mobile-bot-team-task-status'

type RoutinesRead = Awaited<ReturnType<typeof listMobileBotTeamRoutines>>

/** A team's routines as the host last answered, with the way to change one in place. */
export function useMobileBotTeamRoutines(client: RpcClient, teamId: string, offline: boolean) {
  const [read, setRead] = useState<RoutinesRead | null>(null)
  const reload = useCallback(async () => {
    setRead(await listMobileBotTeamRoutines(client, teamId))
  }, [client, teamId])
  useEffect(() => {
    if (!offline) {
      void reload()
    }
  }, [reload, offline])
  const replace = useCallback((routine: BotTeamRoutine) => {
    setRead((current) =>
      current?.kind === 'ready'
        ? {
            kind: 'ready',
            value: current.value.map((entry) => (entry.id === routine.id ? routine : entry))
          }
        : current
    )
  }, [])
  const drop = useCallback((routineId: string) => {
    setRead((current) =>
      current?.kind === 'ready'
        ? { kind: 'ready', value: current.value.filter((entry) => entry.id !== routineId) }
        : current
    )
  }, [])
  return { read, replace, drop }
}

/** On and Paused, side by side; pausing keeps the routine's history. */
export function MobileBotTeamRoutineSwitch({
  client,
  routine,
  offline,
  onChanged
}: {
  client: RpcClient
  routine: BotTeamRoutine
  offline: boolean
  onChanged: (routine: BotTeamRoutine) => void
}) {
  const choose = async (paused: boolean) => {
    if (paused === routine.paused) {
      return
    }
    const changed = await setMobileBotTeamRoutinePaused(client, routine.id, paused)
    if (changed) {
      onChanged(changed)
    }
  }
  return (
    <View style={styles.chips}>
      {[
        { label: 'On', paused: false },
        { label: 'Paused', paused: true }
      ].map((option) => (
        <Pressable
          key={option.label}
          accessibilityRole="button"
          accessibilityState={{ selected: routine.paused === option.paused, disabled: offline }}
          disabled={offline}
          onPress={() => void choose(option.paused)}
          style={[styles.chip, routine.paused === option.paused && styles.rowSelected]}
        >
          <Text style={styles.rowTitle}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

/** Routines (M36 and M37): what each does and when, the web addresses under them, and how to add one. */
export function MobileBotTeamRoutines({
  client,
  team,
  offline,
  onBack,
  onOpenRoutine,
  onNewRoutine,
  onEditRoutine,
  onOpenWebhook
}: {
  client: RpcClient
  team: BotTeam
  offline: boolean
  onBack: () => void
  onOpenRoutine: (routineId: string) => void
  onNewRoutine: () => void
  onEditRoutine: (routineId: string) => void
  /** No id means making a new one. */
  onOpenWebhook: (webhookId?: string) => void
}) {
  const { read, replace, drop } = useMobileBotTeamRoutines(client, team.id, offline)
  const [sheetRoutine, setSheetRoutine] = useState<BotTeamRoutine | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const { room } = useMobileBotTeamRoom(client, team.id, offline)
  const statusOf = useMobileBotTeamTaskStatus(client)
  const routines = read?.kind === 'ready' ? read.value : []
  const active = routines.filter((routine) => !isArchivedBotTeamRoutine(routine))
  const archived = routines.filter(isArchivedBotTeamRoutine)
  // An archived routine keeps its row, quiet and without the On and Paused switch.
  const card = (routine: BotTeamRoutine, isArchived: boolean) => {
    const bot = team.bots.find((entry) => entry.id === routine.botId)
    const lastTask = room?.tasks.find((task) => task.id === routine.lastRun?.taskId)
    const lastStatus = routine.lastRun
      ? mobileRoutineRunStatus(routine.lastRun, lastTask, statusOf)
      : null
    return (
      <View key={routine.id} style={[styles.taskCard, isArchived && { opacity: 0.5 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${routine.name}`}
          accessibilityHint="Long press to edit or delete"
          onPress={() => onOpenRoutine(routine.id)}
          onLongPress={offline ? undefined : () => setSheetRoutine(routine)}
          style={styles.sheetHeader}
        >
          {bot ? <MobileBotAgentIcon agentId={bot.agent} size={20} /> : null}
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{routine.name}</Text>
            <Text style={styles.rowMeta}>
              {`${mobileRoutineScheduleLine(routine.schedule)}, ${bot?.name ?? ''}`}
            </Text>
            <Text style={styles.rowMeta}>{mobileRoutineRunsLine(routine, lastStatus)}</Text>
          </View>
          <ChevronRight size={16} color={colors.textMuted} />
        </Pressable>
        {isArchived ? null : (
          <MobileBotTeamRoutineSwitch
            client={client}
            routine={routine}
            offline={offline}
            onChanged={replace}
          />
        )}
      </View>
    )
  }
  return (
    <View style={styles.grow}>
      <MobileBotTeamWorkBar title="Routines" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.form}>
        <Text style={styles.rowMeta}>
          Routines start a task on a schedule. Each run is kept in its history.
        </Text>
        <Text style={styles.label}>Routines</Text>
        {read?.kind === 'unsupported' ? (
          <Text style={styles.message}>This host cannot run routines yet.</Text>
        ) : null}
        {offline || read?.kind === 'failed' ? (
          <Text style={styles.message}>Check the connection to this host and try again.</Text>
        ) : null}
        {read?.kind === 'ready' && routines.length === 0 ? (
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>No routines yet</Text>
              <Text style={styles.rowMeta}>
                {`A routine starts a task with one bot in ${team.name}, on the schedule you choose.`}
              </Text>
            </View>
          </View>
        ) : null}
        {active.map((routine) => card(routine, false))}
        {archived.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: archiveOpen }}
            onPress={() => setArchiveOpen((open) => !open)}
            style={styles.sheetHeader}
          >
            {archiveOpen ? (
              <ChevronDown size={16} color={colors.textSecondary} />
            ) : (
              <ChevronRight size={16} color={colors.textSecondary} />
            )}
            <Text style={styles.label}>{`Archived ${archived.length}`}</Text>
          </Pressable>
        ) : null}
        {archiveOpen ? archived.map((routine) => card(routine, true)) : null}
        {read?.kind === 'ready' ? (
          <Pressable
            accessibilityRole="button"
            onPress={onNewRoutine}
            style={[styles.primary, offline && styles.primaryDisabled]}
          >
            <Text style={styles.primaryText}>New routine</Text>
          </Pressable>
        ) : null}
        <MobileBotTeamWebhookRows
          client={client}
          team={team}
          offline={offline}
          onOpen={onOpenWebhook}
        />
        <Text style={styles.rowMeta}>{`These run on the host ${team.name} uses.`}</Text>
      </ScrollView>
      <MobileBotTeamRoutineSheet
        routine={sheetRoutine}
        onClose={() => setSheetRoutine(null)}
        onEdit={() => {
          setSheetRoutine(null)
          if (sheetRoutine) {
            onEditRoutine(sheetRoutine.id)
          }
        }}
        onDelete={() => {
          setSheetRoutine(null)
          if (sheetRoutine) {
            askDeleteMobileBotTeamRoutine(client, sheetRoutine, drop)
          }
        }}
      />
    </View>
  )
}
