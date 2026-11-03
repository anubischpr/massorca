import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamEngramMemory } from './MobileBotTeamEngramMemory'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft' }))

const TEAM = {
  id: 'team',
  name: 'Dev',
  purpose: '',
  character: 'circle' as const,
  workspacesEnabled: true,
  accessMode: 'full-access' as const,
  bots: []
}
const PROJECT = {
  id: 'p1',
  teamId: 'team',
  name: 'Site',
  goal: '',
  workspace: { key: 'repo:r1', name: 'massorca' }
}
const OK = {
  status: 'ok',
  projectName: 'massorca',
  memories: [
    { id: '1', title: 'Branch is kept', type: 'decision', excerpt: 'Kept after a finish.' }
  ]
}

function host(engramReply: object, projects: object[] = [PROJECT]) {
  return {
    sendRequest: vi.fn(async (method: string) =>
      method === 'botTeams.listRoom'
        ? {
            ok: true,
            result: {
              tasks: [],
              messages: [],
              projects,
              projectTasks: [],
              replying: [],
              workspaceId: null
            }
          }
        : { ok: true, result: engramReply }
    )
  }
}

async function render(client: { sendRequest: unknown }, team = TEAM) {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The section only calls sendRequest.
      createElement(MobileBotTeamEngramMemory, { client: client as never, team, offline: false })
    )
  })
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  return renderer
}

describe('MobileBotTeamEngramMemory', () => {
  it('shows the latest memories read-only', async () => {
    const client = host(OK)
    const screen = JSON.stringify((await render(client)).toJSON())
    expect(screen).toContain('Branch is kept')
    expect(screen).toContain('Kept after a finish.')
    expect(screen).toContain('decision')
    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.listEngramMemory',
      { teamId: 'team', projectId: 'p1', refresh: true },
      expect.anything()
    )
  })

  it('says the Engram server could not be refreshed, while showing the local memories', async () => {
    const screen = JSON.stringify((await render(host({ ...OK, refreshFailed: true }))).toJSON())
    expect(screen).toContain('Branch is kept')
    expect(screen).toContain('Could not refresh from the Engram server.')
  })

  it('searches when the person submits a query', async () => {
    const client = host(OK)
    const renderer = await render(client)
    const input = renderer.root.findByType('TextInput')
    await act(async () => input.props.onChangeText(' worktree '))
    await act(async () => renderer.root.findByType('TextInput').props.onSubmitEditing())
    expect(client.sendRequest).toHaveBeenLastCalledWith(
      'botTeams.listEngramMemory',
      { teamId: 'team', projectId: 'p1', query: 'worktree' },
      expect.anything()
    )
  })

  it('says when there is nothing, when the host has no Engram, and when it failed', async () => {
    const empty = JSON.stringify(
      (await render(host({ status: 'ok', projectName: 'massorca', memories: [] }))).toJSON()
    )
    expect(empty).toContain('No Engram memories for massorca yet.')
    const missing = JSON.stringify(
      (await render(host({ status: 'unavailable', memories: [] }))).toJSON()
    )
    expect(missing).toContain('Engram is not available on this host.')
    const failed = JSON.stringify((await render(host({ status: 'failed', memories: [] }))).toJSON())
    expect(failed).toContain('Could not read Engram. Try again.')
  })

  it('shows nothing when workspaces are off or no project is linked', async () => {
    const off = await render(host(OK), { ...TEAM, workspacesEnabled: false })
    expect(off.toJSON()).toBeNull()
    const unlinked = await render(host(OK, [{ ...PROJECT, workspace: null }]))
    expect(unlinked.toJSON()).toBeNull()
  })
})
