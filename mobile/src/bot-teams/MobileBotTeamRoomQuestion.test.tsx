import { createElement } from 'react'
import { act, create, type ReactTestInstance } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { colors } from '../theme/mobile-theme'
import { MobileBotTeamRoom } from './MobileBotTeamRoom'
import { MobileBotTeamRoomMenu } from './MobileBotTeamRoomMenu'

const feed = vi.hoisted(() => ({ statuses: new Map<string, { status: string }>() }))
const session = vi.hoisted(() => ({
  asked: [] as (string | null)[],
  question: new Map<string, object>(),
  respondQuestion: vi.fn(async () => true),
  cancelPrompt: vi.fn(async () => true)
}))

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('../components/MobileRepoIcon', () => ({ MobileRepoIcon: () => null }))
vi.mock('lucide-react-native', () => ({
  Bot: 'Bot',
  Brain: 'Brain',
  Check: 'Check',
  ChevronDown: 'ChevronDown',
  ChevronLeft: 'ChevronLeft',
  Ellipsis: 'Ellipsis',
  FileText: 'FileText',
  Folder: 'Folder',
  FolderPlus: 'FolderPlus',
  LayoutGrid: 'LayoutGrid',
  MessageSquare: 'MessageSquare',
  SlidersHorizontal: 'SlidersHorizontal',
  Pencil: 'Pencil',
  Link2: 'Link2',
  Archive: 'Archive',
  ArchiveRestore: 'ArchiveRestore',
  Trash2: 'Trash2'
}))
vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  cancelAnimation: () => {},
  useAnimatedStyle: (style: () => object) => style(),
  useSharedValue: (value: number) => ({ value }),
  withDelay: (_delay: number, value: unknown) => value,
  withRepeat: (value: unknown) => value,
  withSequence: (...values: unknown[]) => values[0],
  withTiming: (value: number) => value
}))
vi.mock('../onboarding/use-reduced-motion', () => ({ useReducedMotionEnabled: () => false }))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: () => null }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: () => null }))
vi.mock('./MobileBotAgentIcon', () => ({
  MobileBotAgentIcon: ({ agentId }: { agentId: string }) => createElement('AgentIcon', { agentId })
}))
vi.mock('../components/BottomDrawer', () => ({
  BottomDrawer: ({ visible, children }: { visible: boolean; children: unknown }) =>
    visible ? children : null
}))
vi.mock('../hooks/use-mobile-dictation', () => ({
  useMobileDictation: () => ({ isRecording: false, start: vi.fn(), stop: vi.fn() })
}))
vi.mock('../session/MobileNativeChatComposer', () => ({ MobileNativeChatComposer: 'Composer' }))
vi.mock('../session/MobileNativeChatMessage', () => ({ MobileNativeChatMessage: 'ChatMessage' }))
vi.mock('../session/MobileNativeChatPromptCard', () => ({
  MobileNativeChatPromptCard: 'PromptCard'
}))
vi.mock('../session/mobile-structured-session-status-feed', () => ({
  mobileStructuredSessionStatusFeed: () => ({
    subscribe: () => () => {},
    getSnapshot: () => feed.statuses
  })
}))
vi.mock('../transport/runtime-capability-probe', () => ({
  startRuntimeCapabilityProbe: (_client: unknown, onCapabilities: (list: string[]) => void) => {
    onCapabilities([])
    return () => {}
  }
}))
vi.mock('../session/use-mobile-structured-agent-session', () => ({
  useMobileStructuredAgentSession: (args: { sessionId: string | null }) => {
    session.asked.push(args.sessionId)
    return {
      question: (args.sessionId && session.question.get(args.sessionId)) ?? null,
      respondQuestion: session.respondQuestion,
      cancelPrompt: session.cancelPrompt
    }
  }
}))

const BOT = {
  id: 'bot',
  name: 'Iris',
  job: '',
  agent: 'claude' as const,
  modelMode: 'auto' as const,
  model: null,
  effort: null,
  skills: []
}
const TEAM = {
  id: 'team',
  name: 'Marketing',
  purpose: '',
  character: 'circle' as const,
  workspacesEnabled: false,
  accessMode: 'full-access' as const,
  bots: [BOT]
}
const task = (id: string, sessionId: string | null) => ({
  id,
  teamId: 'team',
  title: `Task ${id}`,
  prompt: '',
  ownerBotId: 'bot',
  sessionId,
  projectId: null
})

function client() {
  const sendRequest = vi.fn(async (method: string) =>
    method === 'botTeams.listRoom'
      ? {
          ok: true,
          result: {
            messages: [],
            tasks: [task('t1', 's1'), task('t2', 's2')],
            projects: [],
            workspaceId: 'ws'
          }
        }
      : { ok: true, result: {} }
  )
  return { sendRequest } as never
}

async function mountRoom() {
  let renderer!: ReturnType<typeof create>
  await act(async () => {
    renderer = create(
      createElement(MobileBotTeamRoom, {
        client: client(),
        team: TEAM,
        teams: [TEAM],
        onBack: () => {},
        onPickTeam: () => {},
        onOpenBots: () => {},
        onOpenTask: () => {},
        onOpenWork: () => {},
        onAddBot: () => {},
        onNewTeam: () => {}
      })
    )
  })
  return renderer
}

const flat = (node: ReactTestInstance): Record<string, unknown> =>
  Object.assign({}, ...[node.props.style].flat(5).filter(Boolean))
const cards = (renderer: ReturnType<typeof create>) =>
  renderer.root.findAll((node) => node.props.accessibilityLabel?.startsWith('Open '))

beforeEach(() => {
  feed.statuses = new Map()
  session.asked.length = 0
  session.question.clear()
  session.respondQuestion.mockClear()
})
afterEach(() => vi.clearAllMocks())

describe('a task session waiting for the person, in the phone room', () => {
  it('shows the prompt card under the task bot, and answering it answers the session', async () => {
    feed.statuses = new Map([['s1', { status: 'attention' }]])
    session.question.set('s1', { question: 'Which logo?' })
    const renderer = await mountRoom()
    const card = renderer.root.findAllByType('PromptCard')
    expect(card).toHaveLength(1)
    expect(card[0]!.props.question).toEqual({ question: 'Which logo?' })
    const entry = renderer.root.findByProps({ testID: 'room-question-t1' })
    expect(entry.findAllByType('AgentIcon')).toHaveLength(1)
    await act(async () => {
      await card[0]!.props.onAnswerQuestion('1')
    })
    expect(session.respondQuestion).toHaveBeenCalledWith('1')
  })

  it('reads no session and shows no card for a task that is not waiting', async () => {
    feed.statuses = new Map([
      ['s1', { status: 'attention' }],
      ['s2', { status: 'working' }]
    ])
    session.question.set('s1', { question: 'Which logo?' })
    session.question.set('s2', { question: 'Other?' })
    const renderer = await mountRoom()
    expect(renderer.root.findAllByType('PromptCard')).toHaveLength(1)
    expect(session.asked).not.toContain('s2')
  })

  it('shows nothing for a waiting session with no pending question', async () => {
    feed.statuses = new Map([['s1', { status: 'attention' }]])
    const renderer = await mountRoom()
    expect(renderer.root.findAllByType('PromptCard')).toHaveLength(0)
  })
})

describe('the orange mark on the phone', () => {
  it('colours the waiting task card and its dot in the question orange only', async () => {
    feed.statuses = new Map([
      ['s1', { status: 'attention' }],
      ['s2', { status: 'working' }]
    ])
    const renderer = await mountRoom()
    const [waiting, working] = cards(renderer).map((node) => node.parent!)
    expect(flat(waiting!).borderColor).toBe(colors.statusOrange)
    expect(flat(working!).borderColor).not.toBe(colors.statusOrange)
    const dots = (root: ReactTestInstance) =>
      root.findAll((node) => flat(node).backgroundColor === colors.statusOrange)
    expect(dots(waiting!).length).toBeGreaterThan(0)
    expect(dots(working!)).toHaveLength(0)
  })

  it('marks the Conference room row of the room menu while a task waits', async () => {
    const menu = (waiting: boolean) =>
      createElement(MobileBotTeamRoomMenu, {
        visible: true,
        onClose: () => {},
        team: TEAM,
        working: false,
        unreachable: false,
        openCount: 1,
        taskCount: 1,
        waiting,
        projects: [],
        projectTaskCount: () => 0,
        onOpenBoard: () => {},
        onOpenProject: () => {},
        onNewProject: () => {},
        onOpenBots: () => {},
        onOpenFiles: () => {},
        onOpenMemory: () => {}
      })
    let renderer!: ReturnType<typeof create>
    await act(async () => {
      renderer = create(menu(true))
    })
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: 'Waiting for you' })
    ).not.toHaveLength(0)
    await act(async () => renderer.update(menu(false)))
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Waiting for you' })).toHaveLength(0)
  })
})
