import { useCallback, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { Check, ChevronDown, ChevronLeft, Ellipsis } from 'lucide-react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import { useMobileDictation } from '../hooks/use-mobile-dictation'
import { MobileNativeChatComposer } from '../session/MobileNativeChatComposer'
import type { ComposerSuggestion } from '../session/MobileNativeChatComposerSuggestions'
import { MobileNativeChatMessage } from '../session/MobileNativeChatMessage'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { botTeamBoardColumn } from '../../../src/shared/bot-team-board-column'
import { botTeamComposerMenu } from '../../../src/shared/bot-team-composer-menu'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type {
  BotTeamMessage,
  BotTeamTask
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { MobileBotTeamRoomMenu } from './MobileBotTeamRoomMenu'
import { MobileBotTeamTaskCard } from './MobileBotTeamTaskCard'
import type { BotTeamWorkScreen } from './MobileBotTeamWork'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { postMobileBotTeamRequest, startMobileBotTeamTask } from './mobile-bot-team-room-rpc'
import { useMobileBotTeamRoom } from './use-mobile-bot-team-room'
import { useMobileBotTeamTaskStatus } from './use-mobile-bot-team-task-status'

const NO_GENERATION = () => 0
const NOT_WORKING = () => false

function roomChatMessage(message: BotTeamMessage): NativeChatMessage {
  return {
    id: message.id,
    role: message.authorBotId === null ? 'user' : 'assistant',
    blocks: [{ type: 'text', text: message.text }],
    timestamp: null,
    source: 'transcript'
  }
}

/** A team's Conference room, drawn from the session chat's own composer and message row. */
export function MobileBotTeamRoom({
  client,
  team,
  teams,
  offline = false,
  workingOf = NOT_WORKING,
  onBack,
  onPickTeam,
  onOpenBots,
  onOpenTask,
  onOpenWork
}: {
  client: RpcClient
  team: BotTeam
  teams: readonly BotTeam[]
  /** The host stopped answering: nothing can be sent, and what is shown may be out of date. */
  offline?: boolean
  /** The team's real state, so its character shows when its bots are working. */
  workingOf?: (teamId: string) => boolean
  onBack: () => void
  onPickTeam: (teamId: string) => void
  onOpenBots: () => void
  onOpenTask: (workspaceId: string, task: BotTeamTask) => void
  /** Opens one of the room menu's work screens: the team board, a project, or a new project. */
  onOpenWork: (screen: BotTeamWorkScreen) => void
}) {
  const [text, setText] = useState('')
  const [needsLead, setNeedsLead] = useState(false)
  const [sheet, setSheet] = useState<'rooms' | 'menu' | null>(null)
  const { room, reload } = useMobileBotTeamRoom(client, team.id, offline)
  const statusOf = useMobileBotTeamTaskStatus(client)
  const messages = room?.messages ?? []
  const tasks = room?.tasks ?? []
  const projects = room?.projects ?? []
  const workspaceId = room?.workspaceId ?? null
  const dictation = useMobileDictation({
    client,
    enabled: !offline,
    onTranscript: (transcript) =>
      setText((current) => (current ? `${current} ${transcript}` : transcript)),
    onError: (error) => Alert.alert('Dictation failed', error.message)
  })

  const sending = useRef(false)

  // The phone has no Sessions panel to open, so the room's two commands stay on the desktop.
  const roomSuggestions = useCallback(
    (composerText: string, cursor: number): ComposerSuggestion[] | null => {
      const menu = botTeamComposerMenu({ text: composerText, caret: cursor, bots: team.bots })
      return (
        menu?.items.flatMap((item) =>
          item.kind === 'bot'
            ? [
                {
                  kind: 'custom' as const,
                  key: item.bot.id,
                  insert: item.insert,
                  label: item.bot.name,
                  ...(item.bot.job ? { detail: item.bot.job } : {}),
                  icon: <MobileBotAgentIcon agentId={item.bot.agent} size={16} />
                }
              ]
            : []
        ) ?? null
      )
    },
    [team.bots]
  )

  const send = async (typed: string): Promise<boolean> => {
    if (sending.current) {
      return false
    }
    sending.current = true
    const sent = await postMobileBotTeamRequest(client, {
      teamId: team.id,
      text: typed,
      start: true
    }).finally(() => {
      sending.current = false
    })
    if (!sent.ok) {
      Alert.alert('That did not send', 'Check the connection to this host and try again.')
      return false
    }
    setText('')
    setNeedsLead(sent.task === null)
    if (sent.startError) {
      Alert.alert('The bot did not start', sent.startError)
    }
    await reload()
    return true
  }

  const start = async (taskId: string) => {
    const error = await startMobileBotTeamTask(client, taskId)
    if (error) {
      Alert.alert('The bot did not start', error)
    }
    await reload()
  }

  // A task sits under the request that made it; the rest follow the conversation.
  const tasksOf = useMemo(() => {
    const placed = new Map<string, BotTeamTask[]>()
    const rest: BotTeamTask[] = []
    for (const task of tasks) {
      const request = messages.find((m) => m.authorBotId === null && m.text === task.prompt)
      if (request) {
        placed.set(request.id, [...(placed.get(request.id) ?? []), task])
      } else {
        rest.push(task)
      }
    }
    return { placed, rest }
  }, [messages, tasks])

  const card = (task: BotTeamTask) => (
    <MobileBotTeamTaskCard
      key={task.id}
      client={client}
      task={task}
      team={team}
      offline={offline}
      onStart={() => void start(task.id)}
      onOpen={() => {
        if (workspaceId) {
          onOpenTask(workspaceId, task)
        }
      }}
    />
  )

  const openCount = tasks.filter((task) => botTeamBoardColumn(statusOf(task)) !== 'Done').length

  return (
    <View style={styles.grow}>
      <View style={styles.floatBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.roundButton}
        >
          <ChevronLeft size={20} color={colors.textPrimary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch Conference room"
          onPress={() => setSheet('rooms')}
          style={styles.roomPill}
        >
          <MobileBotTeamCharacterIcon
            character={team.character}
            size={20}
            working={workingOf(team.id)}
            unreachable={offline}
          />
          <Text style={styles.roomPillText} numberOfLines={1}>
            {team.name}
          </Text>
          <ChevronDown size={14} color={colors.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Room menu"
          onPress={() => setSheet('menu')}
          style={styles.roundButton}
        >
          <Ellipsis size={20} color={colors.textPrimary} />
        </Pressable>
      </View>
      <ScrollView
        style={styles.grow}
        contentContainerStyle={styles.roomFeed}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && tasks.length === 0 ? (
          <Text style={styles.message}>
            Ask {team.name} for something. Each request becomes one or more tasks.
          </Text>
        ) : null}
        {messages.map((message) => {
          const author = team.bots.find((bot) => bot.id === message.authorBotId)
          return (
            <View key={message.id} style={styles.roomEntry}>
              {author ? (
                <View style={styles.roomWho}>
                  <MobileBotAgentIcon agentId={author.agent} size={14} />
                  <Text style={styles.roomWhoText}>{author.name}</Text>
                </View>
              ) : null}
              <MobileNativeChatMessage message={roomChatMessage(message)} />
              {tasksOf.placed.get(message.id)?.map(card)}
            </View>
          )
        })}
        {tasksOf.rest.map(card)}
        {needsLead ? (
          <Text style={styles.rowMeta}>
            Who should take this? Mention a bot with @ and its name.
          </Text>
        ) : null}
      </ScrollView>
      <MobileNativeChatComposer
        value={text}
        onChangeText={setText}
        onSend={send}
        sendSurfaceId={team.id}
        getSendCompletionGeneration={NO_GENERATION}
        getComposerEditGeneration={NO_GENERATION}
        disabled={offline}
        placeholder="Message the team"
        customSuggestions={roomSuggestions}
        onMicPress={() => void (dictation.isRecording ? dictation.stop() : dictation.start())}
        micActive={dictation.isRecording}
      />
      <BottomDrawer visible={sheet === 'rooms'} onClose={() => setSheet(null)}>
        <Text style={styles.sheetTitle}>Conference rooms</Text>
        {teams.map((entry) => (
          <Pressable
            key={entry.id}
            accessibilityRole="button"
            onPress={() => {
              setSheet(null)
              onPickTeam(entry.id)
            }}
            style={styles.row}
          >
            <MobileBotTeamCharacterIcon
              character={entry.character}
              size={28}
              working={workingOf(entry.id)}
              unreachable={offline}
            />
            <Text style={[styles.rowTitle, styles.grow]}>{entry.name}</Text>
            {entry.id === team.id ? <Check size={18} color={colors.textPrimary} /> : null}
          </Pressable>
        ))}
      </BottomDrawer>
      <MobileBotTeamRoomMenu
        visible={sheet === 'menu'}
        onClose={() => setSheet(null)}
        team={team}
        working={workingOf(team.id)}
        unreachable={offline}
        openCount={openCount}
        taskCount={tasks.length}
        projects={projects}
        projectTaskCount={(projectId) =>
          tasks.filter((task) => task.projectId === projectId).length
        }
        onOpenBoard={() => {
          setSheet(null)
          onOpenWork({ name: 'board', teamId: team.id })
        }}
        onOpenProject={(projectId) => {
          setSheet(null)
          onOpenWork({ name: 'project', teamId: team.id, projectId, tab: 'board' })
        }}
        onNewProject={() => {
          setSheet(null)
          onOpenWork({ name: 'newProject', teamId: team.id })
        }}
        onOpenBots={() => {
          setSheet(null)
          onOpenBots()
        }}
      />
    </View>
  )
}
