import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { MobileBotTeamRoom } from './MobileBotTeamRoom'
import { BotTeamRoomPrototypeOpenContext } from './MobileBotTeamRoomPrototypeLinks'

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  ArrowDown: 'ArrowDown',
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
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: () => null }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: () => null }))
vi.mock('./MobileBotTeamTaskCard', () => ({ MobileBotTeamTaskCard: () => null }))
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
vi.mock('../components/BottomDrawer', () => ({ BottomDrawer: () => null }))
vi.mock('../hooks/use-mobile-dictation', () => ({
  useMobileDictation: () => ({ isRecording: false, start: vi.fn(), stop: vi.fn() })
}))
vi.mock('../session/MobileNativeChatComposer', () => ({ MobileNativeChatComposer: 'Composer' }))
vi.mock('../session/MobileNativeChatMessage', () => ({ MobileNativeChatMessage: 'ChatMessage' }))
vi.mock('./MobileBotTeamRoomQuestion', () => ({ MobileBotTeamRoomQuestions: () => null }))
vi.mock('../session/mobile-structured-session-status-feed', () => ({
  mobileStructuredSessionStatusFeed: () => ({
    subscribe: () => () => {},
    getSnapshot: () => new Map()
  })
}))

function listedSet(
  requestId: string,
  sessionId: string,
  origin?: PrototypeListedSet['origin']
): PrototypeListedSet {
  return {
    requestId,
    sessionId,
    agent: 'claude',
    worktreeId: null,
    chatTitle: null,
    originalPrompt: 'Rediseños',
    createdAt: '2026-11-03T01:00:00.000Z',
    count: 2,
    directions: [],
    ...(origin ? { origin } : {})
  }
}

// A child session's set records the task session as its origin; another task's set does not match.
const SETS = vi.hoisted(() => ({ list: [] as PrototypeListedSet[] }))
vi.mock('../session/mobile-prototype-host-rpc', () => ({
  listMobilePrototypeSets: () => Promise.resolve({ kind: 'ready', sets: SETS.list })
}))

const BOT = {
  id: 'bot',
  name: 'Cristhofer',
  job: '',
  agent: 'claude' as const,
  modelMode: 'auto' as const,
  model: null,
  effort: null,
  skills: []
}
const TEAM = {
  id: 'team',
  name: 'Design',
  purpose: '',
  character: 'circle' as const,
  workspacesEnabled: false,
  accessMode: 'full-access' as const,
  bots: [BOT]
}
const ROOM = {
  tasks: [
    {
      id: 'task',
      teamId: 'team',
      title: 'Exploración y rediseños con Jev AI',
      prompt: 'Explora',
      ownerBotId: 'bot',
      sessionId: 'task-session',
      projectId: null,
      createdAt: 10
    }
  ],
  messages: [
    { id: 'ask', teamId: 'team', authorBotId: null, text: 'Explora', createdAt: 9 },
    { id: 'ack', teamId: 'team', authorBotId: 'bot', text: 'On it', createdAt: 11 },
    { id: 'report', teamId: 'team', authorBotId: 'bot', text: 'Done', createdAt: 40 }
  ],
  workspaceId: null
}

/** `open` is what the Conference room wrapper provides; without it the room has no way into Prototypes. */
async function mount(open: ((set: PrototypeListedSet) => void) | null = null) {
  const client = {
    sendRequest: vi.fn(async (method: string) =>
      method === 'botTeams.listRoom' ? { ok: true, result: ROOM } : { ok: true, result: {} }
    )
  }
  let renderer: ReactTestRenderer | undefined
  await act(async () => {
    renderer = create(
      createElement(
        BotTeamRoomPrototypeOpenContext.Provider,
        { value: open },
        createElement(MobileBotTeamRoom, {
          client: client as never,
          team: TEAM,
          teams: [TEAM],
          onBack: vi.fn(),
          onPickTeam: vi.fn(),
          onOpenBots: vi.fn(),
          onOpenTask: vi.fn(),
          onOpenWork: vi.fn(),
          onAddBot: vi.fn(),
          onNewTeam: vi.fn()
        })
      )
    )
  })
  await act(async () => {})
  if (renderer === undefined) {
    throw new Error('the room did not mount')
  }
  return renderer
}

function linksUnder(renderer: ReactTestRenderer, messageText: string) {
  const entry = renderer.root.findAll(
    (node) =>
      node.type === 'View' &&
      node.children.some(
        (child) => typeof child !== 'string' && child.props.message?.text === messageText
      )
  )[0]
  return entry.findAll(
    (node) =>
      node.type === 'Pressable' &&
      typeof node.props.accessibilityLabel === 'string' &&
      node.props.accessibilityLabel.endsWith(', Open')
  )
}

describe('MobileBotTeamRoom Prototypes links', () => {
  it('shows a task child-session set under the owner bot latest report only, and opens it', async () => {
    SETS.list = [
      listedSet('from-child', 'child-1', { sessionId: 'task-session' }),
      listedSet('elsewhere', 'other-session')
    ]
    const onOpenPrototypeSet = vi.fn()
    const renderer = await mount(onOpenPrototypeSet)
    const underReport = linksUnder(renderer, 'Done')
    expect(underReport).toHaveLength(1)
    expect(linksUnder(renderer, 'On it')).toHaveLength(0)
    expect(linksUnder(renderer, 'Explora')).toHaveLength(0)
    act(() => underReport[0].props.onPress())
    expect(onOpenPrototypeSet).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'from-child' })
    )
  })

  it('shows no link when the room has no way to open Prototypes', async () => {
    SETS.list = [listedSet('own', 'task-session')]
    const renderer = await mount()
    expect(linksUnder(renderer, 'Done')).toHaveLength(0)
  })
})
