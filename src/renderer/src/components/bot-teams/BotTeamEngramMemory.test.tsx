/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ENGRAM_REFRESH_MAX_POLLS,
  ENGRAM_REFRESH_POLL_MS,
  type BotTeamEngramReply
} from '../../../../shared/rpc-contract/bot-team-engram-params'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const engram = vi.hoisted(() => ({ listBotTeamEngramMemory: vi.fn() }))
const room = vi.hoisted(() => ({ listBotTeamRoom: vi.fn() }))
vi.mock('@/runtime/runtime-bot-team-engram-client', () => engram)
vi.mock('@/runtime/runtime-bot-team-project-client', () => room)
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))

const { BotTeamEngramMemory } = await import('./BotTeamEngramMemory')

const TEAM: BotTeam = {
  id: 'dev',
  name: 'Dev',
  purpose: '',
  character: 'square',
  workspacesEnabled: true,
  accessMode: 'default',
  bots: []
}
const LINKED = { id: 'p1', name: 'Site', workspace: { key: 'repo:r1', name: 'massorca' } }
const MEMORIES: BotTeamEngramReply = {
  status: 'ok',
  projectName: 'massorca',
  memories: [
    { id: '1', title: 'Branch is kept', type: 'decision', excerpt: 'Kept after a finish.' },
    { id: '2', title: 'Panels stay hidden', excerpt: 'Filter by visible.' }
  ]
}

const mounted: { container: HTMLDivElement; root: Root }[] = []
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.useRealTimers()
  vi.clearAllMocks()
})

const UPDATING = 'Updating from the Engram server…'

async function mount(reply: BotTeamEngramReply, team: BotTeam = TEAM, projects = [LINKED]) {
  room.listBotTeamRoom.mockResolvedValue({ tasks: [], messages: [], projects })
  engram.listBotTeamEngramMemory.mockResolvedValue(reply)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => root.render(<BotTeamEngramMemory team={team} />))
  return container
}

describe('BotTeamEngramMemory', () => {
  it('shows the latest memories read-only, with their type and excerpt', async () => {
    const container = await mount(MEMORIES)
    const text = container.textContent ?? ''
    expect(text).toContain('Branch is kept')
    expect(text).toContain('decision')
    expect(text).toContain('Kept after a finish.')
    expect(container.querySelectorAll('button')).toHaveLength(1)
    expect(engram.listBotTeamEngramMemory).toHaveBeenCalledWith({
      teamId: 'dev',
      projectId: 'p1',
      refresh: true
    })
  })

  it('says the Engram server could not be refreshed, while showing the local memories', async () => {
    const container = await mount({ ...MEMORIES, refreshFailed: true })
    expect(container.textContent).toContain('Branch is kept')
    expect(container.textContent).toContain('Could not refresh from the Engram server.')
  })

  it('searches the project when the person submits a query', async () => {
    const container = await mount(MEMORIES)
    const input = container.querySelector('input') as HTMLInputElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, ' worktree ')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(engram.listBotTeamEngramMemory).toHaveBeenLastCalledWith({
      teamId: 'dev',
      projectId: 'p1',
      query: 'worktree'
    })
  })

  it('says there is nothing yet, naming the project', async () => {
    const container = await mount({ status: 'ok', projectName: 'massorca', memories: [] })
    expect(container.textContent).toContain('No Engram memories for massorca yet.')
  })

  it('says Engram is not available on this host, or could not be read', async () => {
    const missing = await mount({ status: 'unavailable', projectName: 'massorca', memories: [] })
    expect(missing.textContent).toContain('Engram is not available on this host.')
    const failed = await mount({ status: 'failed', projectName: 'massorca', memories: [] })
    expect(failed.textContent).toContain('Could not read Engram. Try again.')
  })

  it('says the Engram server is being read, and asks again until the refresh lands', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    engram.listBotTeamEngramMemory.mockResolvedValueOnce({ ...MEMORIES, refreshing: true })
    const container = await mount(MEMORIES)
    expect(container.textContent).toContain(UPDATING)
    expect(container.textContent).toContain('Branch is kept')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ENGRAM_REFRESH_POLL_MS)
    })
    expect(engram.listBotTeamEngramMemory).toHaveBeenCalledTimes(2)
    expect(engram.listBotTeamEngramMemory).toHaveBeenLastCalledWith({
      teamId: 'dev',
      projectId: 'p1'
    })
    expect(container.textContent).not.toContain(UPDATING)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ENGRAM_REFRESH_POLL_MS * 3)
    })
    expect(engram.listBotTeamEngramMemory).toHaveBeenCalledTimes(2)
  })

  it('stops asking after fifteen refreshes, and when the view unmounts', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await mount({ ...MEMORIES, refreshing: true })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ENGRAM_REFRESH_POLL_MS * (ENGRAM_REFRESH_MAX_POLLS + 5))
    })
    expect(engram.listBotTeamEngramMemory).toHaveBeenCalledTimes(1 + ENGRAM_REFRESH_MAX_POLLS)

    const entry = mounted.pop()
    act(() => entry?.root.unmount())
    entry?.container.remove()
    const calls = engram.listBotTeamEngramMemory.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ENGRAM_REFRESH_POLL_MS * 2)
    })
    expect(engram.listBotTeamEngramMemory).toHaveBeenCalledTimes(calls)
  })

  it('shows nothing when workspaces are off or no project is linked', async () => {
    const off = await mount(MEMORIES, { ...TEAM, workspacesEnabled: false })
    expect(off.textContent).toBe('')
    const unlinked = await mount(MEMORIES, TEAM, [{ ...LINKED, workspace: null }] as never)
    expect(unlinked.textContent).toBe('')
    expect(engram.listBotTeamEngramMemory).not.toHaveBeenCalled()
  })
})
