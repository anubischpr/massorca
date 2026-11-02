/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeamEngramReply } from '../../../../shared/rpc-contract/bot-team-engram-params'
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
  vi.clearAllMocks()
})

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
    expect(engram.listBotTeamEngramMemory).toHaveBeenCalledWith({ teamId: 'dev', projectId: 'p1' })
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

  it('shows nothing when workspaces are off or no project is linked', async () => {
    const off = await mount(MEMORIES, { ...TEAM, workspacesEnabled: false })
    expect(off.textContent).toBe('')
    const unlinked = await mount(MEMORIES, TEAM, [{ ...LINKED, workspace: null }] as never)
    expect(unlinked.textContent).toBe('')
    expect(engram.listBotTeamEngramMemory).not.toHaveBeenCalled()
  })
})
