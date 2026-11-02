import { useCallback, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { Check, ChevronDown, ChevronLeft, Ellipsis } from 'lucide-react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import { useMobileDictation } from '../hooks/use-mobile-dictation'
import { MobileNativeChatComposer } from '../session/MobileNativeChatComposer'
import { MobileNativeChatMessage } from '../session/MobileNativeChatMessage'
import { useMobileNativeChatFileSearch } from '../session/use-mobile-native-chat-file-search'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { botTeamBoardColumn } from '../../../src/shared/bot-team-board-column'
import { BOT_TEAM_ALL_AUTHOR } from '../../../src/shared/bot-team-greeting'
import type { BotTeamRequestChoice } from '../../../src/shared/bot-team-request-choice'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type {
  BotTeamMessage,
  BotTeamTask
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { MobileBotTeamRequestChoice } from './MobileBotTeamRequestChoice'
import { MobileBotTeamRoomMenu } from './MobileBotTeamRoomMenu'
import { botTeamRoomSuggestions } from './MobileBotTeamRoomSuggestions'
import { MobileBotTeamTaskCard } from './MobileBotTeamTaskCard'
import type { BotTeamWorkScreen } from './MobileBotTeamWork'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { postMobileBotTeamRequest, startMobileBotTeamTask } from './mobile-bot-team-room-rpc'
import { assignMobileBotTeamRequest } from './mobile-bot-team-request-rpc'
import { useMobileBotTeamRoom } from './use-mobile-bot-team-room'
import { useMobileBotTeamTaskStatus } from './use-mobile-bot-team-task-status'

const NO_GENERATION = () => 0
const NOT_WORKING = () => false
const NO_FILES: readonly string[] = []

function roomChatMessage(message: BotTeamMessage): NativeChatMessage {
  return {
    id: message.id,
    role: message.authorBotId === null ? 'user' : 'assistant',
    blocks: [{ type: 'text', text: message.text }],
    timestamp: null,
    source: 'transcript'
  }
}

/** Who wrote a message: one bot, or every bot's icon under "All" for the team's greeting. */
function RoomWho({ bots, authorBotId }: { bots: BotTeam['bots']; authorBotId: string | null }) {
  if (authorBotId === BOT_TEAM_ALL_AUTHOR) {
    return (
      <View style={styles.roomWho}>
        {bots.map((bot) => (
          <MobileBotAgentIcon key={bot.id} agentId={bot.agent} size={14} />
        ))}
        <Text style={styles.roomWhoText}>All</Text>
      </View>
    )
  }
  const author = bots.find((bot) => bot.id === authorBotId)
  return author ? (
    <View style={styles.roomWho}>
      <MobileBotAgentIcon agentId={author.agent} size={14} />
      <Text style={styles.roomWhoText}>{author.name}</Text>
    </View>
  ) : null
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
  onOpenWork,
  onAddBot,
  onNewTeam
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
  /** The choice card's "Create a new bot" and "Create a new team" open the existing forms. */
  onAddBot: () => void
  onNewTeam: () => void
}) {
  const [text, setText] = useState('')
  const [needsOwner, setNeedsOwner] = useState(false)
  // The person's line, held until they choose where it goes; leaving the room drops it.
  const [pending, setPending] = useState<{ choice: BotTeamRequestChoice; text: string } | null>(
    null
  )
  const [choiceBusy, setChoiceBusy] = useState(false)
  const [sheet, setSheet] = useState<'rooms' | 'menu' | null>(null)
  const { room, reload } = useMobileBotTeamRoom(client, team.id, offline)
  const statusOf = useMobileBotTeamTaskStatus(client)
  const messages = room?.messages ?? []
  const tasks = room?.tasks ?? []
  const projects = room?.projects ?? []
  const workspaceId = room?.workspaceId ?? null
  const { nativeChatFilePaths, loadNativeChatFiles } = useMobileNativeChatFileSearch({
    client: offline ? null : client,
    worktreeId: workspaceId ?? ''
  })
  const dictation = useMobileDictation({
    client,
    enabled: !offline,
    onTranscript: (transcript) =>
      setText((current) => (current ? `${current} ${transcript}` : transcript)),
    onError: (error) => Alert.alert('Dictation failed', error.message)
  })

  const sending = useRef(false)

  // The phone has no Sessions panel to open, so the room's two commands stay on the desktop.
  const files = workspaceId === null ? NO_FILES : nativeChatFilePaths
  const otherTeams = useMemo(() => teams.filter((entry) => entry.id !== team.id), [teams, team.id])
  const roomSuggestions = useCallback(
    (composerText: string, cursor: number) =>
      botTeamRoomSuggestions({ text: composerText, caret: cursor, team, otherTeams, files }),
    [team, otherTeams, files]
  )

  const send = async (typed: string): Promise<boolean> => {
    if (sending.current) {
      return false
    }
    sending.current = true
    // Clears at once; a refused send puts the text back unless more was typed.
    setText('')
    const sent = await postMobileBotTeamRequest(client, {
      teamId: team.id,
      text: typed,
      start: true
    }).finally(() => {
      sending.current = false
    })
    if (!sent.ok) {
      setText((current) => (current === '' ? typed : current))
      Alert.alert('That did not send', 'Check the connection to this host and try again.')
      return false
    }
    setNeedsOwner(
      sent.task === null &&
        !sent.greeted &&
        sent.choice === null &&
        !sent.answered &&
        sent.sentTo === null
    )
    setPending(sent.choice ? { choice: sent.choice, text: typed } : null)
    if (sent.startError) {
      Alert.alert('The bot did not start', sent.startError)
    }
    await reload()
    return true
  }

  // Files the held request where the person chose; an empty target keeps it in this team.
  const fileChoice = async (target: { botId?: string; toTeamId?: string }) => {
    if (pending === null) {
      return
    }
    setChoiceBusy(true)
    const filed = await assignMobileBotTeamRequest(client, {
      teamId: team.id,
      text: pending.text,
      ...target
    })
    setChoiceBusy(false)
    if (filed.kind === 'unsupported') {
      Alert.alert('That did not send', 'This host cannot route requests yet.')
      return
    }
    if (filed.kind === 'failed') {
      Alert.alert('That did not send', 'Check the connection to this host and try again.')
      return
    }
    setPending(null)
    if (filed.startError) {
      Alert.alert('The bot did not start', filed.startError)
    }
    await reload()
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
      teams={teams}
      offline={offline}
      onStart={() => void start(task.id)}
      onReassigned={() => void reload()}
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
          return (
            <View key={message.id} style={styles.roomEntry}>
              <RoomWho bots={team.bots} authorBotId={message.authorBotId} />
              <MobileNativeChatMessage message={roomChatMessage(message)} />
              {tasksOf.placed.get(message.id)?.map(card)}
            </View>
          )
        })}
        {tasksOf.rest.map(card)}
        {pending ? (
          <MobileBotTeamRequestChoice
            choice={pending.choice}
            team={team}
            otherTeams={teams.filter((entry) => entry.id !== team.id)}
            busy={choiceBusy}
            onSendToBot={(botId) => void fileChoice({ botId })}
            onSendToTeam={(toTeamId) => void fileChoice({ toTeamId })}
            onKeep={() => void fileChoice({})}
            onCreateBot={onAddBot}
            onCreateTeam={onNewTeam}
          />
        ) : null}
        {needsOwner ? (
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
        onNeedFiles={workspaceId === null ? undefined : loadNativeChatFiles}
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
        onOpenFiles={() => {
          setSheet(null)
          onOpenWork({ name: 'files', teamId: team.id })
        }}
        onOpenMemory={() => {
          setSheet(null)
          onOpenWork({ name: 'memory', teamId: team.id })
        }}
      />
    </View>
  )
}
