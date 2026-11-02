import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamBoard } from './MobileBotTeamBoard'

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
vi.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft' }))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: () => null }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: () => null }))
vi.mock('../session/mobile-structured-session-status-feed', () => ({
  mobileStructuredSessionStatusFeed: () => ({
    subscribe: () => () => {},
    getSnapshot: () => new Map()
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

async function render(props: Partial<Parameters<typeof MobileBotTeamBoard>[0]> = {}) {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      createElement(MobileBotTeamBoard, {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The board only passes the client to the mocked status feed.
        client: {} as never,
        team: TEAM,
        tasks: [FLYER, POSTER],
        projects: [PROJECT],
        workspaceId: 'folder:1',
        working: false,
        offline: false,
        onBack: vi.fn(),
        onOpenTask: vi.fn(),
        ...props
      })
    )
  })
  return renderer
}

const press = async (renderer: ReactTestRenderer, label: string) => {
  const target = renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      (node.props.accessibilityLabel === label ||
        node.findAll((child) => child.children.includes(label)).length > 0)
  )[0]
  await act(async () => target.props.onPress())
}

describe('MobileBotTeamBoard', () => {
  it('filters the team board by project and counts each filter', async () => {
    const renderer = await render()
    const text = () => JSON.stringify(renderer.toJSON())
    expect(text()).toContain('All 2')
    expect(text()).toContain('Launch 1')
    expect(text()).toContain('No project 1')

    await press(renderer, 'Launch 1')
    expect(text()).toContain('Flyer')
    expect(text()).not.toContain('Poster')

    await press(renderer, 'No project 1')
    expect(text()).toContain('Poster')
    expect(text()).not.toContain('Flyer')
  })

  it('opens a started task in its workspace', async () => {
    const onOpenTask = vi.fn()
    const renderer = await render({ onOpenTask })
    await press(renderer, 'Open Poster')
    expect(onOpenTask).toHaveBeenCalledWith('folder:1', POSTER)
  })

  it('says when the board holds no tasks', async () => {
    const renderer = await render({ tasks: [] })
    expect(JSON.stringify(renderer.toJSON())).toContain('No tasks here.')
  })
})
