import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileBotTeamBoard } from './MobileBotTeamBoard'

// The session statuses the board reads; a test sets one to make its task finished.
const feed = vi.hoisted(() => ({ statuses: new Map<string, unknown>() }))

vi.mock('../components/BottomDrawer', () => ({
  BottomDrawer: ({ visible, children }: { visible: boolean; children: unknown }) =>
    visible ? children : null
}))
vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  Check: 'Check',
  ChevronDown: 'ChevronDown',
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight'
}))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: () => null }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: () => null }))
vi.mock('../session/mobile-structured-session-status-feed', () => ({
  mobileStructuredSessionStatusFeed: () => ({
    subscribe: () => () => {},
    getSnapshot: () => feed.statuses
  })
}))

const TEAM = {
  id: 'team',
  name: 'Marketing',
  purpose: '',
  character: 'circle' as const,
  workspacesEnabled: true,
  accessMode: 'full-access' as const,
  bots: [
    {
      id: 'bot',
      name: 'Iris',
      job: '',
      agent: 'claude' as const,
      modelMode: 'auto' as const,
      model: null,
      effort: null,
      skills: []
    }
  ]
}
const PROJECT = {
  id: 'project',
  teamId: 'team',
  name: 'Launch',
  goal: '',
  codeSource: null,
  brief: { requirements: [], constraints: [], decisions: [] },
  briefUpdatedAt: null
}
const FLYER = {
  id: 'task_1',
  teamId: 'team',
  title: 'Flyer',
  prompt: '',
  ownerBotId: 'bot',
  sessionId: 's1',
  projectId: 'project'
}
const POSTER = {
  id: 'task_2',
  teamId: 'team',
  title: 'Poster',
  prompt: '',
  ownerBotId: 'bot',
  sessionId: 's2',
  projectId: null
}
const ROUTINE = {
  id: 'routine',
  teamId: 'team',
  botId: 'bot',
  name: 'Wednesday check-in',
  prompt: 'List what is open.',
  schedule: { frequency: 'once', time: '10:00', weekday: null, monthDay: null, date: '2026-11-04' },
  paused: false,
  nextRun: { date: '2026-11-04', time: '10:00' },
  lastRun: null
}

/** A host that answers the routines read with `routines`, and refuses every other request. */
function hostWithRoutines(routines: readonly unknown[]) {
  const sendRequest = vi.fn(async (method: string) =>
    method === 'botTeams.listRoutines'
      ? { ok: true, result: { routines } }
      : { ok: false, error: { code: 'method_not_found', message: 'nope' } }
  )
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The board only sends requests through sendRequest.
  return { client: { sendRequest } as never }
}

async function render(props: Partial<Parameters<typeof MobileBotTeamBoard>[0]> = {}) {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      createElement(MobileBotTeamBoard, {
        client: hostWithRoutines([]).client,
        team: TEAM,
        teams: [TEAM],
        tasks: [FLYER, POSTER],
        projects: [PROJECT],
        workspaceId: 'folder:1',
        working: false,
        offline: false,
        onBack: vi.fn(),
        onOpenTask: vi.fn(),
        onChanged: vi.fn(),
        ...props
      })
    )
  })
  // The routines are read once the board is shown.
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  return renderer
}

/** Presses the control whose accessibility label is `label`, or the first one showing that text. */
const press = async (renderer: ReactTestRenderer, label: string) => {
  const target = renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      (node.props.accessibilityLabel === label ||
        node.findAll((child) => child.children.includes(label)).length > 0)
  )[0]
  await act(async () => target.props.onPress())
}

const pressLabel = async (renderer: ReactTestRenderer, label: string) => {
  const target = renderer.root.findAll(
    (node) => typeof node.props.onPress === 'function' && node.props.accessibilityLabel === label
  )[0]
  await act(async () => target.props.onPress())
}

describe('MobileBotTeamBoard', () => {
  beforeEach(() => {
    feed.statuses.clear()
  })

  it('opens on Active, hides finished tasks, and lists the statuses in the desktop order', async () => {
    feed.statuses.set('s2', { status: 'idle' })
    const renderer = await render()
    const text = () => JSON.stringify(renderer.toJSON())
    expect(text()).toContain('Flyer')
    expect(text()).not.toContain('Poster')
    expect(text()).not.toContain('All 2')
    expect(text().indexOf('Active 1')).toBeGreaterThan(-1)
    expect(text().indexOf('Active 1')).toBeLessThan(text().indexOf('Stopped 0'))
    expect(text().indexOf('Stopped 0')).toBeLessThan(text().indexOf('Done 1'))

    await press(renderer, 'Done 1')
    expect(text()).toContain('Poster')
    expect(text()).not.toContain('Flyer')
  })

  it('filters the board by the project selector', async () => {
    const renderer = await render()
    const text = () => JSON.stringify(renderer.toJSON())
    expect(text()).toContain('Flyer')
    expect(text()).toContain('Poster')

    await pressLabel(renderer, 'Project')
    await pressLabel(renderer, 'Launch')
    expect(text()).toContain('Flyer')
    expect(text()).not.toContain('Poster')

    await pressLabel(renderer, 'Project')
    await pressLabel(renderer, 'No project')
    expect(text()).toContain('Poster')
    expect(text()).not.toContain('Flyer')
  })

  it('shows every project again when All projects is chosen', async () => {
    const renderer = await render()
    const text = () => JSON.stringify(renderer.toJSON())
    await pressLabel(renderer, 'Project')
    await pressLabel(renderer, 'Launch')
    expect(text()).not.toContain('Poster')

    await pressLabel(renderer, 'Project')
    await pressLabel(renderer, 'All projects')
    expect(text()).toContain('Flyer')
    expect(text()).toContain('Poster')
  })

  it('opens a started task in its workspace', async () => {
    const onOpenTask = vi.fn()
    const renderer = await render({ onOpenTask })
    await press(renderer, 'Open Poster')
    expect(onOpenTask).toHaveBeenCalledWith('folder:1', POSTER)
  })

  it('says when the view holds no tasks', async () => {
    const renderer = await render({ tasks: [] })
    expect(JSON.stringify(renderer.toJSON())).toContain('No active tasks')
  })

  it('shows the scheduled one-time routines under Active, and under All or No project only', async () => {
    const renderer = await render({ client: hostWithRoutines([ROUTINE]).client })
    const text = () => JSON.stringify(renderer.toJSON())
    expect(text()).toContain('Wednesday check-in')
    expect(text()).toContain('Scheduled · Wed 4 Nov, 10:00')

    await pressLabel(renderer, 'Project')
    await pressLabel(renderer, 'No project')
    expect(text()).toContain('Wednesday check-in')

    await pressLabel(renderer, 'Project')
    await pressLabel(renderer, 'Launch')
    expect(text()).not.toContain('Wednesday check-in')
    expect(text()).toContain('Flyer')

    await pressLabel(renderer, 'Project')
    await pressLabel(renderer, 'All projects')
    await press(renderer, 'Stopped 0')
    expect(text()).not.toContain('Wednesday check-in')
  })
})
