import { createElement, type ComponentProps } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileBotTeamRoom } from './MobileBotTeamRoom'

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('../components/MobileRepoIcon', () => ({ MobileRepoIcon: () => null }))
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
vi.mock('../components/BottomDrawer', () => ({
  BottomDrawer: ({ visible, children }: { visible: boolean; children: unknown }) =>
    visible ? children : null
}))
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

function teamWith(id: string) {
  return {
    id,
    name: 'Marketing',
    purpose: '',
    character: 'circle' as const,
    workspacesEnabled: false,
    accessMode: 'full-access' as const,
    bots: [BOT]
  }
}

const ROOM = {
  tasks: [],
  messages: [
    { id: 'm1', teamId: 'team', authorBotId: null, text: 'First', timestamp: null },
    { id: 'm2', teamId: 'team', authorBotId: 'bot', text: 'Latest', timestamp: null }
  ],
  workspaceId: null
}

// Geometry the native list reports: a 400pt viewport over 1000pt of content.
const VIEWPORT = 400
const CONTENT = 1000

function host(room: object = ROOM) {
  return {
    sendRequest: vi.fn(async (method: string) => {
      if (method === 'botTeams.listRoom') {
        return { ok: true, result: room }
      }
      return { ok: true, result: { paths: [] } }
    })
  }
}

/** A scroll the way the native list reports it, at an offset from the top. */
function scrollAt(offset: number) {
  return {
    nativeEvent: {
      contentOffset: { x: 0, y: offset },
      contentSize: { width: 400, height: CONTENT },
      layoutMeasurement: { width: 400, height: VIEWPORT }
    }
  }
}

let frames: FrameRequestCallback[] = []

function flushFrames(): void {
  act(() => {
    while (frames.length > 0) {
      frames.shift()?.(0)
    }
  })
}

type Props = ComponentProps<typeof MobileBotTeamRoom>

async function render(team: Props['team'], client = host()) {
  const scroller = { scrollToEnd: vi.fn(), scrollTo: vi.fn() }
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      createElement(MobileBotTeamRoom, {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The room only calls sendRequest and the mocked status feed.
        client: client as never,
        team,
        teams: [team],
        onBack: vi.fn(),
        onPickTeam: vi.fn(),
        onOpenBots: vi.fn(),
        onOpenTask: vi.fn(),
        onOpenWork: vi.fn(),
        onAddBot: vi.fn(),
        onNewTeam: vi.fn()
      }),
      {
        createNodeMock: (element) => (element.type === 'ScrollView' ? scroller : null)
      }
    )
  })
  return { renderer, scroller, list: () => renderer.root.findByType('ScrollView').props }
}

function jumpControl(renderer: ReactTestRenderer) {
  return renderer.root.findAll((node) => node.props.accessibilityLabel === 'Scroll to latest')
}

describe('the Conference room scroll', () => {
  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens at the latest message', async () => {
    const { list, scroller } = await render(teamWith('phone-open'))

    list().onLayout({ nativeEvent: { layout: { height: VIEWPORT } } })
    list().onContentSizeChange(400, CONTENT)
    flushFrames()

    expect(scroller.scrollToEnd).toHaveBeenCalled()
    expect(scroller.scrollTo).not.toHaveBeenCalled()
  })

  it('shows the jump control when scrolled up, and pressing it lands at the end', async () => {
    const { renderer, list, scroller } = await render(teamWith('phone-jump'))
    list().onLayout({ nativeEvent: { layout: { height: VIEWPORT } } })
    list().onContentSizeChange(400, CONTENT)
    flushFrames()

    act(() => list().onScrollBeginDrag())
    act(() => list().onScroll(scrollAt(100)))
    act(() => list().onScrollEndDrag(scrollAt(100)))
    flushFrames()

    expect(jumpControl(renderer)).toHaveLength(1)
    scroller.scrollToEnd.mockClear()
    await act(async () => jumpControl(renderer)[0]?.props.onPress())
    expect(scroller.scrollToEnd).toHaveBeenCalled()
    expect(jumpControl(renderer)).toHaveLength(0)
  })

  it('returns to the scrolled-up position it was left at', async () => {
    const team = teamWith('phone-return')
    const first = await render(team)
    first.list().onLayout({ nativeEvent: { layout: { height: VIEWPORT } } })
    first.list().onContentSizeChange(400, CONTENT)
    flushFrames()
    act(() => first.list().onScrollBeginDrag())
    act(() => first.list().onScroll(scrollAt(100)))
    act(() => first.list().onScrollEndDrag(scrollAt(100)))
    flushFrames()
    act(() => first.renderer.unmount())

    const second = await render(team)
    second.list().onLayout({ nativeEvent: { layout: { height: VIEWPORT } } })
    second.list().onContentSizeChange(400, CONTENT)
    flushFrames()

    expect(second.scroller.scrollTo).toHaveBeenCalledWith({ y: 100, animated: false })
    expect(second.scroller.scrollToEnd).not.toHaveBeenCalled()
  })

  it('a room the reader never scrolled up from still lands at the end', async () => {
    const team = teamWith('phone-follow')
    const first = await render(team)
    act(() => first.renderer.unmount())

    const second = await render(team)
    second.list().onLayout({ nativeEvent: { layout: { height: VIEWPORT } } })
    second.list().onContentSizeChange(400, CONTENT)
    flushFrames()

    expect(second.scroller.scrollToEnd).toHaveBeenCalled()
    expect(second.scroller.scrollTo).not.toHaveBeenCalled()
  })
})
