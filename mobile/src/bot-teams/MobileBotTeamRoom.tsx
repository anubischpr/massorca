import { useMemo, useRef, useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { ChevronDown, ChevronLeft, Ellipsis } from 'lucide-react-native'
import { useMobileDictation } from '../hooks/use-mobile-dictation'
import { useMobileNativeChatFileSearch } from '../session/use-mobile-native-chat-file-search'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { botTeamBoardColumn } from '../../../src/shared/bot-team-board-column'
import { placeBotTeamRoomTasks } from '../../../src/shared/bot-team-room-order'
import type { BotTeamRequestChoice } from '../../../src/shared/bot-team-request-choice'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type {
  BotTeamSentRequest,
  BotTeamTask
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { useMobileBotTeamReplying } from './use-mobile-bot-team-room-replying'
import { MobileBotTeamTypingLine } from './MobileBotTeamTypingLine'
import { MobileBotTeamProjectQuestion } from './MobileBotTeamProjectQuestion'
import { MobileBotTeamRequestChoice } from './MobileBotTeamRequestChoice'
import { MobileBotTeamRoomMenu } from './MobileBotTeamRoomMenu'
import { MobileBotTeamRoomSwitcher } from './MobileBotTeamRoomSwitcher'
import { MobileBotTeamRoomQuestions } from './MobileBotTeamRoomQuestion'
import { useBotTeamComposerSuggestions } from './use-mobile-bot-team-composer-suggestions'
import { MobileBotTeamTaskCard } from './MobileBotTeamTaskCard'
import type { BotTeamWorkScreen } from './MobileBotTeamWork'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import { postMobileBotTeamRequest, startMobileBotTeamTask } from './mobile-bot-team-room-rpc'
import {
  assignMobileBotTeamRequest,
  type MobileBotTeamRequestFiling
} from './mobile-bot-team-request-rpc'
import { useMobileBotTeamRoom } from './use-mobile-bot-team-room'
import { MobileBotTeamRoomScroll, RoomMessageText } from './MobileBotTeamRoomScroll'
import { useMobileBotTeamTaskStatus } from './use-mobile-bot-team-task-status'
import { RoomWho } from './MobileBotTeamRoomWho'
import { MobileBotTeamSentTrackers } from './MobileBotTeamRoomTracker'
import { MobileBotTeamAttachChips } from './MobileBotTeamAttachChips'
import { MobileBotTeamRoomComposer } from './MobileBotTeamRoomComposer'
import { useBotTeamMentionRenderer } from './MobileBotTeamMentionChip'
import { useBotTeamMentionProjects } from './use-mobile-bot-team-mention-projects'
import { useMobileBotTeamRoomAttachments } from './mobile-bot-team-attach-room'
import { MarkdownPlainTextContext } from '../components/MobileMarkdownPlainText'
import { useBotTeamRoomPrototypeLinks } from './MobileBotTeamRoomPrototypeLinks'

const NOT_WORKING = () => false
const NO_FILES: readonly string[] = []

/** A request the room holds until the person says where it goes. */
type HeldRequest = { choice: BotTeamRequestChoice; text: string; later: boolean }
/** The person's answer for a held request: a bot, another team, or a project. */
type FilingTarget = Pick<
  MobileBotTeamRequestFiling,
  'botId' | 'toTeamId' | 'alsoNeeds' | 'projectId'
>

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
  onOpenRoutines,
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
  /** The room menu's Routines: the team's routines, going back to this room. */
  onOpenRoutines: () => void
  /** The choice card's "Create a new bot" and "Create a new team" open the existing forms. */
  onAddBot: () => void
  onNewTeam: () => void
}) {
  const [text, setText] = useState('')
  const [needsOwner, setNeedsOwner] = useState(false)
  const [typing, setTyping] = useState<string | null>(null)
  // The person's line, held until they choose where it goes; leaving the room drops it.
  const [pending, setPending] = useState<HeldRequest | null>(null)
  const [choiceBusy, setChoiceBusy] = useState(false)
  const [sheet, setSheet] = useState<'rooms' | 'menu' | null>(null)
  const { room, reload } = useMobileBotTeamRoom(client, team.id, offline)
  const statusOf = useMobileBotTeamTaskStatus(client)
  const messages = room?.messages ?? []
  const replying = useMobileBotTeamReplying(room?.replying, team.bots)
  const tasks = room?.tasks ?? []
  const allProjects = room?.projects ?? []
  const projects = allProjects.filter((project) => project.archivedAt == null)
  const mentionProjects = useBotTeamMentionProjects(client, team, allProjects, offline)
  const projectTasks = room?.projectTasks ?? []
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
  const attachments = useMobileBotTeamRoomAttachments({ client, workspaceId, enabled: !offline })
  const renderMentions = useBotTeamMentionRenderer(team, teams, mentionProjects)

  // The phone has no Sessions panel to open, so the room's two commands stay on the desktop.
  const files = workspaceId === null ? NO_FILES : nativeChatFilePaths
  const roomSuggestions = useBotTeamComposerSuggestions(team, teams, mentionProjects, files)

  const send = async (typed: string): Promise<boolean> => {
    if (sending.current) {
      return false
    }
    sending.current = true
    // Clears at once; a refused send puts the text back unless more was typed.
    setText('')
    setTyping(typed)
    const sent = await postMobileBotTeamRequest(client, {
      teamId: team.id,
      text: typed,
      start: true,
      askProject: true,
      clientRequestId: replying.requestIdFor(typed),
      ...(attachments.postable.length > 0 ? { attachments: attachments.postable } : {})
    }).finally(() => {
      sending.current = false
      setTyping(null)
    })
    if (!sent.ok) {
      setText((current) => (current === '' ? typed : current))
      Alert.alert('That did not send', 'Check the connection to this host and try again.')
      return false
    }
    replying.settle(sent.replying?.botId ?? null)
    attachments.clearPosted(attachments.postable)
    setNeedsOwner(
      sent.task === null &&
        !sent.greeted &&
        sent.choice === null &&
        !sent.answered &&
        sent.replying === null &&
        sent.sentTo === null
    )
    setPending(sent.choice ? { choice: sent.choice, text: typed, later: sent.later } : null)
    if (sent.startError) {
      Alert.alert('The bot did not start', sent.startError)
    }
    await reload()
    return true
  }

  // Files the held request where the person chose; an empty target keeps it in this team.
  const fileChoice = async (target: FilingTarget) => {
    if (pending === null) {
      return
    }
    setChoiceBusy(true)
    const filed = await assignMobileBotTeamRequest(client, {
      teamId: team.id,
      text: pending.text,
      askProject: true,
      ...(pending.later ? { later: true } : {}),
      ...target
    })
    setChoiceBusy(false)
    // The host asks its next question before it files, so the held request stays.
    if (filed.kind === 'asked') {
      setPending((current) => (current ? { ...current, choice: filed.choice } : current))
      return
    }
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

  // The project question files the held request with the bot it was asked of.
  const answerProject = (projectId: string | null) => {
    if (pending?.choice.kind === 'project') {
      const { botId, alsoNeeds } = pending.choice
      void fileChoice({ botId, projectId, ...(alsoNeeds ? { alsoNeeds } : {}) })
    }
  }

  const start = async (taskId: string) => {
    const error = await startMobileBotTeamTask(client, taskId)
    if (error) {
      Alert.alert('The bot did not start', error)
    }
    await reload()
  }

  // A card sits right after the request that made it; the rest follow the conversation.
  const placement = useMemo(() => placeBotTeamRoomTasks(messages, tasks), [messages, tasks])
  const prototypeLinks = useBotTeamRoomPrototypeLinks(offline ? null : client, room, team.id)

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
      onOpen={() => workspaceId && onOpenTask(workspaceId, task)}
    />
  )

  const sentRequests = room?.sentRequests ?? []
  const trackers = (requests: readonly BotTeamSentRequest[]) => (
    <MobileBotTeamSentTrackers
      requests={requests}
      teams={teams}
      statusOf={statusOf}
      offline={offline}
      onOpenTeam={onPickTeam}
    />
  )

  const waitingTasks = tasks.filter((task) => statusOf(task) === 'Waiting for you')
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
      <MobileBotTeamRoomScroll teamId={team.id} hasItems={messages.length > 0 || tasks.length > 0}>
        {messages.length === 0 && tasks.length === 0 ? (
          <Text style={styles.message}>
            Ask {team.name} for something. Each request becomes one or more tasks.
          </Text>
        ) : null}
        <MarkdownPlainTextContext.Provider value={renderMentions}>
          {messages.map((message) => {
            const from = teams.find((entry) => entry.id === message.fromTeamId)
            return (
              <View key={message.id} style={styles.roomEntry}>
                <RoomWho bots={(from ?? team).bots} authorBotId={message.authorBotId} from={from} />
                <RoomMessageText message={message} />
                <MobileBotTeamAttachChips
                  files={message.attachments ?? []}
                  tag={from ? `From ${from.name}` : undefined}
                />
                {prototypeLinks(message.id)}
                {placement.cardsByMessageId.get(message.id)?.map(card)}
                {trackers(sentRequests.filter((request) => request.messageId === message.id))}
              </View>
            )
          })}
        </MarkdownPlainTextContext.Provider>
        {placement.trailing.map(card)}
        {trackers(
          sentRequests.filter((request) => !messages.some((m) => m.id === request.messageId))
        )}
        {offline ? null : (
          <MobileBotTeamRoomQuestions
            client={client}
            team={team}
            tasks={waitingTasks}
            scope={`${team.id}:${workspaceId ?? ''}`}
          />
        )}
        <MobileBotTeamTypingLine text={typing} author={replying.author} bots={team.bots} />
        {pending && pending.choice.kind === 'project' ? (
          <MobileBotTeamProjectQuestion
            projects={projects}
            busy={choiceBusy}
            onAnswer={answerProject}
          />
        ) : null}
        {pending && pending.choice.kind !== 'project' ? (
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
      </MobileBotTeamRoomScroll>
      <MobileBotTeamAttachChips inset files={attachments.files} onRemove={attachments.removeFile} />
      <MobileBotTeamRoomComposer
        team={team}
        teams={teams}
        projects={mentionProjects}
        value={text}
        onChangeText={setText}
        onSend={send}
        disabled={offline}
        customSuggestions={roomSuggestions}
        onNeedFiles={workspaceId === null ? undefined : loadNativeChatFiles}
        onMicPress={() => void (dictation.isRecording ? dictation.stop() : dictation.start())}
        micActive={dictation.isRecording}
        isAttaching={attachments.attaching}
        onAttachFile={attachments.attachFile}
        sendWithoutText={attachments.postable.length > 0}
      />
      <MobileBotTeamRoomSwitcher
        visible={sheet === 'rooms'}
        teams={teams}
        currentTeamId={team.id}
        workingOf={workingOf}
        unreachable={offline}
        onClose={() => setSheet(null)}
        onPick={onPickTeam}
      />
      <MobileBotTeamRoomMenu
        client={offline ? undefined : client}
        teams={teams}
        onChanged={() => void reload()}
        visible={sheet === 'menu'}
        onClose={() => setSheet(null)}
        team={team}
        working={workingOf(team.id)}
        unreachable={offline}
        openCount={room ? openCount : null}
        taskCount={room ? tasks.length : null}
        waiting={waitingTasks.length > 0}
        projects={allProjects}
        projectTaskCount={(projectId) =>
          [...tasks, ...projectTasks].filter((task) => task.projectId === projectId).length
        }
        onOpenBoard={() => {
          setSheet(null)
          onOpenWork({ name: 'board', teamId: team.id })
        }}
        onOpenRoutines={() => {
          setSheet(null)
          onOpenRoutines()
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
