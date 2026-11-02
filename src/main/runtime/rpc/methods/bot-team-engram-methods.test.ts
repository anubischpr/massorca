import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RpcContext } from '../core'
import { botTeamListEngramMemoryMethod, engramCli } from './bot-team-engram-methods'
import { BOT_TEAM_MEMORY_METHODS } from './bot-team-memory-methods'

function context(workspacesEnabled: boolean, workspace: { key: string; name: string } | null) {
  return {
    runtime: {
      getOrchestrationDb: () => ({
        listBotTeams: () => [{ id: 't1', workspacesEnabled }],
        getBotTeamProject: () => ({ id: 'p1', workspace })
      }),
      listRepos: () => [{ id: 'r1', path: 'D:\\projects\\massorca\\' }]
    }
  } as unknown as RpcContext
}
const LINKED = { key: 'repo:r1', name: 'Display Name' }
const IDS = { teamId: 't1', projectId: 'p1' }

describe('botTeams.listEngramMemory', () => {
  const originalRun = engramCli.run
  afterEach(() => {
    engramCli.run = originalRun
  })

  it('reads the linked repo folder name through the injected runner', async () => {
    const run = vi.fn(async () => ({
      code: 0,
      stdout: '### Recent Observations\n- [passive] **A**: body\n',
      timedOut: false
    }))
    engramCli.run = run
    const result = await botTeamListEngramMemoryMethod.handler(IDS, context(true, LINKED))
    expect(run).toHaveBeenCalledWith(['context', 'massorca'])
    expect(result).toMatchObject({ status: 'ok', projectName: 'massorca' })
    expect(result.memories).toHaveLength(1)
  })

  it('searches only the linked project', async () => {
    const run = vi.fn(async () => ({ code: 0, stdout: '', timedOut: false }))
    engramCli.run = run
    await botTeamListEngramMemoryMethod.handler(
      { ...IDS, query: 'worktree', limit: 3 },
      context(true, LINKED)
    )
    expect(run).toHaveBeenCalledWith([
      'search',
      'worktree',
      '--project',
      'massorca',
      '--limit',
      '3'
    ])
  })

  it('is not-linked when workspaces are off or the project has no link, without running the CLI', async () => {
    const run = vi.fn()
    engramCli.run = run
    for (const ctx of [context(false, LINKED), context(true, null)]) {
      expect(await botTeamListEngramMemoryMethod.handler(IDS, ctx)).toEqual({
        status: 'not-linked',
        memories: []
      })
    }
    expect(run).not.toHaveBeenCalled()
  })

  it('falls back to the linked project name for a group', async () => {
    const run = vi.fn(async () => ({ code: 0, stdout: '', timedOut: false }))
    engramCli.run = run
    await botTeamListEngramMemoryMethod.handler(
      IDS,
      context(true, { key: 'group:g1', name: 'Client work' })
    )
    expect(run).toHaveBeenCalledWith(['context', 'Client work'])
  })

  it('reports a missing CLI as unavailable and validates its params', async () => {
    engramCli.run = async () => {
      throw Object.assign(new Error('missing'), { code: 'ENOENT' })
    }
    expect(await botTeamListEngramMemoryMethod.handler(IDS, context(true, LINKED))).toEqual({
      status: 'unavailable',
      projectName: 'massorca',
      memories: []
    })
    const params = botTeamListEngramMemoryMethod.params
    expect(() => params?.parse({ ...IDS, limit: 21 })).toThrow()
    expect(() => params?.parse({ ...IDS, query: 'x'.repeat(201) })).toThrow()
    expect(BOT_TEAM_MEMORY_METHODS).toContain(botTeamListEngramMemoryMethod)
  })
})
