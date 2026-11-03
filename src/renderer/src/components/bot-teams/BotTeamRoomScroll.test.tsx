/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const listBotTeamRoom = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeamRoom,
  postBotTeamRequest: vi.fn(),
  setBotTeamTaskProject: vi.fn(),
  startBotTeamTask: vi.fn()
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))
vi.mock('@/runtime/bot-team-host', () => ({
  BOT_TEAM_LOCAL_HOST: 'local',
  botTeamHostTarget: () => ({ kind: 'local' }),
  useBotTeamHost: () => 'local'
}))
vi.mock('@/components/native-chat/NativeChatView', () => ({ default: () => null }))
vi.mock('@/components/native-chat/use-pending-session-question', () => ({
  usePendingSessionQuestion: () => null
}))
vi.mock('@/components/native-chat/NativeChatStructuredQuestionCard', () => ({
  NativeChatStructuredQuestionCard: () => null
}))
vi.mock('../../app-shell/right-sidebar-page-slot', () => ({
  useRightSidebarPageTarget: () => null
}))
vi.mock('./use-bot-team-task-status', () => ({ useBotTeamSessionStatuses: () => new Map() }))
vi.mock('./BotTeamRoomComposer', () => ({ BotTeamRoomComposer: () => null }))
vi.mock('./BotAgentIcon', () => ({
  BotAgentIcon: ({ agent }: { agent?: string }) => <i data-icon={agent} />
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const { BotTeamRoom } = await import('./BotTeamRoom')

// Geometry the browser would report: a 400px viewport over 1000px of content.
const VIEWPORT_PX = 400
const CONTENT_PX = 1000
const LATEST = CONTENT_PX - VIEWPORT_PX

const offsets = new WeakMap<Element, number>()
const originals = {
  clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight'),
  scrollHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight'),
  scrollTop: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTop')
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => VIEWPORT_PX
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => CONTENT_PX
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
    configurable: true,
    get(this: Element) {
      return offsets.get(this) ?? 0
    },
    set(this: Element, value: number) {
      offsets.set(this, value)
    }
  })
})

afterAll(() => {
  for (const [name, descriptor] of Object.entries(originals)) {
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, name, descriptor)
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, name)
    }
  }
})

const BOT = { modelMode: 'auto' as const, model: null, effort: null, skills: [] }

function teamWith(id: string): BotTeam {
  return {
    id,
    name: 'Marketing',
    purpose: '',
    character: 'square',
    workspacesEnabled: false,
    accessMode: 'default',
    bots: [{ ...BOT, id: 'b1', name: 'Iris', job: 'Designs flyers', agent: 'claude' }]
  }
}

const ROOM = {
  messages: Array.from({ length: 3 }, (_, index) => ({
    id: `m${index}`,
    teamId: 't',
    authorBotId: null,
    text: `Message ${index}`
  })),
  tasks: [],
  projects: [],
  workspaceId: null
}

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const entry of mounted.splice(0)) {
    act(() => entry.root.unmount())
    entry.container.remove()
  }
})

async function mountRoom(team: BotTeam) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const entry = { container, root }
  mounted.push(entry)
  await act(async () =>
    root.render(<BotTeamRoom team={team} offline={false} openTaskId={null} onOpenTask={() => {}} />)
  )
  const scroller = container.querySelector<HTMLElement>('.scrollbar-sleek.overflow-y-auto')
  if (!scroller) {
    throw new Error('the room has no scroll container')
  }
  return { entry, scroller, container }
}

function unmountRoom(entry: { container: HTMLDivElement; root: Root }): void {
  act(() => entry.root.unmount())
  entry.container.remove()
  mounted.splice(mounted.indexOf(entry), 1)
}

/** A reader scroll: the offset moves, then the browser fires the scroll event. */
async function scrollReaderTo(scroller: HTMLElement, offset: number): Promise<void> {
  await act(async () => {
    scroller.scrollTop = offset
    scroller.dispatchEvent(new Event('scroll'))
  })
}

function jumpButton(container: HTMLElement): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes('Jump to latest')
  )
  if (!button) {
    throw new Error('no jump-to-latest button')
  }
  return button
}

describe('the Conference room scroll', () => {
  it('opens at the latest message', async () => {
    listBotTeamRoom.mockResolvedValue(ROOM)
    const { scroller } = await mountRoom(teamWith('t-open'))

    expect(scroller.scrollTop).toBe(LATEST)
  })

  it('shows the jump button when scrolled up, and pressing it lands at the end', async () => {
    listBotTeamRoom.mockResolvedValue(ROOM)
    const { scroller, container } = await mountRoom(teamWith('t-jump'))

    await scrollReaderTo(scroller, 100)
    const jump = jumpButton(container)
    expect(jump.getAttribute('data-shown')).toBe('true')

    await act(async () => jump.click())
    expect(scroller.scrollTop).toBe(LATEST)
    expect(jumpButton(container).getAttribute('data-shown')).toBe('false')
  })

  it('returns to the scrolled-up position it was left at', async () => {
    listBotTeamRoom.mockResolvedValue(ROOM)
    const team = teamWith('t-return')
    const first = await mountRoom(team)
    await scrollReaderTo(first.scroller, 100)
    unmountRoom(first.entry)

    const second = await mountRoom(team)

    expect(second.scroller.scrollTop).toBe(100)
  })

  it('a room the reader never scrolled up from still lands at the end', async () => {
    listBotTeamRoom.mockResolvedValue(ROOM)
    const first = await mountRoom(teamWith('t-follow'))
    unmountRoom(first.entry)

    const second = await mountRoom(teamWith('t-follow'))

    expect(second.scroller.scrollTop).toBe(LATEST)
  })
})
