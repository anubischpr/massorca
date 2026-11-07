/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function team(id: string, name: string, bots: string[]): BotTeam {
  return {
    id,
    name,
    purpose: '',
    character: id === 't1' ? 'square' : 'circle',
    workspacesEnabled: false,
    accessMode: 'default',
    bots: bots.map((bot) => ({
      id: `${id}-${bot}`,
      name: bot,
      job: '',
      agent: 'claude',
      modelMode: 'auto',
      model: null,
      effort: null,
      skills: []
    }))
  }
}

const listBotTeams = vi.hoisted(() => vi.fn())
const listBotTeamRoom = vi.hoisted(() => vi.fn())
const postBotTeamRequest = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())
vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeams,
  listBotTeamRoom,
  postBotTeamRequest
}))
vi.mock('../bot-teams/use-bot-team-files', () => ({ useBotTeamFilePaths: () => ['brief.md'] }))
vi.mock('../bot-teams/BotAgentIcon', () => ({ BotAgentIcon: () => null }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('sonner', () => ({ toast: { error: toastError } }))
vi.mock('@/lib/agent-catalog', () => ({ AgentIcon: () => null }))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { TasksHomeBotTeamSession } = await import('./TasksHomeBotTeamSession')
const { promptTextContent } = await import('../native-chat/native-chat-prompt-document-text')
const { promptEditor } = await import('../native-chat/native-chat-prompt-editor.test-support')
const { clearNativeChatDraftCacheForTests, readNativeChatDraftCache, writeNativeChatDraftCache } =
  await import('../native-chat/native-chat-draft-cache')
const DRAFT_KEY = 'composer:tasks:bot-team'

const mounted: { container: HTMLDivElement; root: Root }[] = []

async function mount(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(
      <TasksHomeBotTeamSession aboveComposer={<i data-switch />} below={<b data-below />} />
    )
  )
  return container
}

/** Types into the team's field, or the plain box shown while no team is picked. */
async function type(container: HTMLElement, text: string): Promise<void> {
  const field = container.querySelector<HTMLElement>('[role="combobox"]')
  if (field) {
    await act(async () => {
      promptEditor(field).commands.setContent(promptTextContent(text), { emitUpdate: true })
      promptEditor(field).commands.focus('end')
    })
    return
  }
  const box = container.querySelector('textarea')
  if (!box) {
    throw new Error('Composer missing')
  }
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(box, text)
    box.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function send(container: HTMLElement): Promise<void> {
  const button = container.querySelector<HTMLButtonElement>('button[aria-label="Create task"]')
  await act(async () => button?.click())
}

function press(label: string): void {
  const trigger = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  act(() => {
    trigger?.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })
    )
  })
}

function pick(label: string): void {
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
    (candidate) => candidate.textContent?.includes(label)
  )
  act(() => item?.click())
}

function task(over: Partial<BotTeamTask> = {}): BotTeamTask {
  return {
    id: 'task-1',
    teamId: 't1',
    title: 'Publish',
    prompt: '',
    ownerBotId: 't1-Iris',
    projectId: null,
    sessionId: null,
    ...over
  }
}

beforeEach(() => {
  listBotTeams.mockReset()
  postBotTeamRequest.mockReset()
  listBotTeamRoom.mockReset()
  toastError.mockReset()
  clearNativeChatDraftCacheForTests()
  listBotTeamRoom.mockResolvedValue({
    messages: [],
    tasks: [],
    projects: [
      {
        id: 'p1',
        teamId: 't1',
        name: 'Shop',
        goal: '',
        workspace: { key: 'repo:r1', name: 'shop' }
      },
      { id: 'p2', teamId: 't1', name: 'Spring', goal: '' }
    ]
  })
  listBotTeams.mockResolvedValue([
    team('t1', 'Marketing', ['Iris', 'Nora']),
    team('t2', 'Sales', ['Leo'])
  ])
  postBotTeamRequest.mockResolvedValue({ task: task(), startError: null })
  seedStore(store, {
    activeView: 'tasks',
    railMode: 'workspaces',
    botTeamsSelection: { teamId: null, taskId: null, creating: false }
  })
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  document.body.innerHTML = ''
})

describe('the Tasks home Bot Team composer', () => {
  it('moves a team character when its row in the team picker is hovered', async () => {
    await mount()
    press('Team')
    const row = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
      (candidate) => candidate.textContent?.includes('Sales')
    )
    expect(row?.querySelector('.bc-root')).not.toBeNull()

    act(() => row?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })))

    expect(row?.querySelector('.bc-root')?.getAttribute('class') ?? '').toMatch(/bc-move-/)
  })

  it('shows the canvas row: team chip, Save to Todo, the team placeholder, and no project chip', async () => {
    const container = await mount()
    expect(container.querySelector('[role="combobox"]')?.getAttribute('aria-label')).toBe(
      'Describe the task for the team…'
    )
    expect(container.querySelector('button[aria-label="Team"]')?.textContent).toContain('Marketing')
    expect(container.querySelector('button[aria-label="When the task starts"]')?.textContent).toBe(
      'Save to Todo'
    )
    expect(container.querySelector('button[aria-label="Project"]')).toBeNull()
    expect(container.querySelector('[data-switch]')).not.toBeNull()
    expect(container.querySelector('[data-below]')).not.toBeNull()
  })

  it('keeps the send button off until there is text', async () => {
    const container = await mount()
    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Create task"]')
    expect(button?.disabled).toBe(true)
    await type(container, '@Iris publish the flyer')
    expect(button?.disabled).toBe(false)
  })

  it('saves the task to Todo through the existing request and opens the team room', async () => {
    const container = await mount()
    await type(container, '@Iris publish the flyer')
    await send(container)
    expect(postBotTeamRequest).toHaveBeenCalledWith({
      teamId: 't1',
      text: '@Iris publish the flyer',
      start: false
    })
    expect(store.getState().activeView).toBe('bot-teams')
    expect(store.getState().railMode).toBe('bot-teams')
    expect(store.getState().botTeamsSelection).toEqual({
      teamId: 't1',
      taskId: null,
      creating: false
    })
  })

  it('starts the task when Start now is picked, and opens its thread', async () => {
    postBotTeamRequest.mockResolvedValue({ task: task({ sessionId: 's-1' }), startError: null })
    const container = await mount()
    press('When the task starts')
    pick('Start now')
    await type(container, '@Iris publish the flyer')
    await send(container)
    expect(postBotTeamRequest).toHaveBeenCalledWith(expect.objectContaining({ start: true }))
    expect(store.getState().botTeamsSelection.taskId).toBe('task-1')
  })

  it('sends the task to the team picked in the chip', async () => {
    const container = await mount()
    press('Team')
    pick('Sales')
    await type(container, 'Check the leads')
    await send(container)
    expect(postBotTeamRequest).toHaveBeenCalledWith(expect.objectContaining({ teamId: 't2' }))
  })

  it('asks who should take it, without posting, when a team of several bots gets no mention', async () => {
    const container = await mount()
    await type(container, 'publish the flyer')
    await send(container)
    expect(postBotTeamRequest).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Who should take this? Mention a bot with @ and its name.'
    )
    expect(store.getState().activeView).toBe('tasks')
  })

  it('needs no mention for a team with one bot', async () => {
    const container = await mount()
    press('Team')
    pick('Sales')
    await type(container, 'Check the leads')
    await send(container)
    expect(postBotTeamRequest).toHaveBeenCalledTimes(1)
  })

  it('reports a bot that could not start, and still opens the room', async () => {
    postBotTeamRequest.mockResolvedValue({ task: task(), startError: 'No agent' })
    const container = await mount()
    await type(container, '@Iris go')
    await send(container)
    expect(toastError).toHaveBeenCalledWith('No agent')
    expect(store.getState().activeView).toBe('bot-teams')
  })

  it('shows the host error and stays on the page when the request fails', async () => {
    postBotTeamRequest.mockRejectedValue(new Error('Host unreachable'))
    const container = await mount()
    await type(container, '@Iris go')
    await send(container)
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Host unreachable')
    expect(store.getState().activeView).toBe('tasks')
  })

  it('offers the room menu after @: bots, other teams, projects with a logo or the name alone, files', async () => {
    seedStore(store, {
      repos: [
        {
          id: 'r1',
          path: '/shop',
          displayName: 'shop',
          badgeColor: '#000',
          addedAt: 0,
          repoIcon: { type: 'emoji', emoji: 'S' }
        }
      ]
    })
    const container = await mount()
    await type(container, '@')
    const options = [...container.querySelectorAll('[role="option"]')].map((o) => o.textContent)
    expect(options).toEqual(['Iris', 'Nora', 'Sales', 'SShop', 'Spring', 'brief.md'])
    const headings = [...container.querySelectorAll('[role="listbox"] > div')].map(
      (heading) => heading.textContent
    )
    expect(headings).toEqual(['Bots', 'Teams', 'Projects', 'Files'])
  })

  it('keeps the unsent task as a draft, brings it back, and clears it once sent', async () => {
    writeNativeChatDraftCache(DRAFT_KEY, '@Iris publish the flyer')
    const first = await mount()
    const field = first.querySelector<HTMLElement>('[role="combobox"]')
    expect(field?.textContent).toBe('@Iris publish the flyer')
    await type(first, '@Iris publish the new flyer')
    expect(readNativeChatDraftCache(DRAFT_KEY)).toBe('@Iris publish the new flyer')
    await send(first)
    expect(postBotTeamRequest).toHaveBeenCalledWith(
      expect.objectContaining({ text: '@Iris publish the new flyer' })
    )
    expect(readNativeChatDraftCache(DRAFT_KEY)).toBe('')
  })

  it('cannot create a task while there are no teams', async () => {
    listBotTeams.mockResolvedValue([])
    const container = await mount()
    expect(container.querySelector('button[aria-label="Team"]')?.textContent).toContain(
      'Choose a team'
    )
    await type(container, '@Iris go')
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Create task"]')?.disabled
    ).toBe(true)
  })
})
