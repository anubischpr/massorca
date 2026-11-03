import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RpcContext } from '../core'
import { createEngramCloudSync } from '../../../bot-teams/bot-team-engram-sync'
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
const IMPORT_ARGS = ['sync', '--import', '--cloud', '--project', 'massorca']
const CONTEXT = {
  code: 0,
  stdout: '### Recent Observations\n- [passive] **A**: body\n',
  timedOut: false
}
const IMPORTED = { code: 0, stdout: 'Imported 62 chunks\n', timedOut: false }
const IMPORT_FAILED = { code: 1, stdout: '', timedOut: false }

describe('botTeams.listEngramMemory', () => {
  const originalRun = engramCli.run
  const originalSync = engramCli.sync
  let now = 0
  beforeEach(() => {
    now = 1_000_000
    engramCli.sync = createEngramCloudSync({ now: () => now })
  })
  afterEach(() => {
    engramCli.run = originalRun
    engramCli.sync = originalSync
  })

  it('reads the linked repo folder name through the injected runner', async () => {
    const run = vi.fn(async () => CONTEXT)
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
    expect(params?.parse({ ...IDS, refresh: true })).toMatchObject({ refresh: true })
    expect(BOT_TEAM_MEMORY_METHODS).toContain(botTeamListEngramMemoryMethod)
  })

  it('imports the linked project from the cloud before it reads the local memories', async () => {
    const calls: string[][] = []
    engramCli.run = async (args) => {
      calls.push([...args])
      return CONTEXT
    }
    await botTeamListEngramMemoryMethod.handler({ ...IDS, refresh: true }, context(true, LINKED))
    expect(calls).toEqual([IMPORT_ARGS, ['context', 'massorca']])
  })

  it('skips the import within five minutes, but the view refresh runs it again', async () => {
    const run = vi.fn(async (args: readonly string[]) => (args[0] === 'sync' ? IMPORTED : CONTEXT))
    engramCli.run = run
    const syncCalls = () => run.mock.calls.filter(([args]) => args[0] === 'sync').length
    await botTeamListEngramMemoryMethod.handler(IDS, context(true, LINKED))
    await botTeamListEngramMemoryMethod.handler(IDS, context(true, LINKED))
    expect(syncCalls()).toBe(1)
    await botTeamListEngramMemoryMethod.handler({ ...IDS, refresh: true }, context(true, LINKED))
    expect(syncCalls()).toBe(2)
  })

  it('shares one import when two refreshes overlap', async () => {
    let finish!: (result: typeof IMPORTED) => void
    const run = vi.fn(async (args: readonly string[]) =>
      args[0] === 'sync'
        ? new Promise<typeof IMPORTED>((resolve) => {
            finish = resolve
          })
        : CONTEXT
    )
    engramCli.run = run
    const first = botTeamListEngramMemoryMethod.handler(
      { ...IDS, refresh: true },
      context(true, LINKED)
    )
    const second = botTeamListEngramMemoryMethod.handler(
      { ...IDS, refresh: true },
      context(true, LINKED)
    )
    finish(IMPORTED)
    await Promise.all([first, second])
    expect(run.mock.calls.filter(([args]) => args[0] === 'sync')).toHaveLength(1)
  })

  it('still returns the local memories, flagged refreshFailed, when the import fails', async () => {
    engramCli.run = async (args) => (args[0] === 'sync' ? IMPORT_FAILED : CONTEXT)
    const result = await botTeamListEngramMemoryMethod.handler(
      { ...IDS, refresh: true },
      context(true, LINKED)
    )
    expect(result).toMatchObject({ status: 'ok', refreshFailed: true })
    expect(result.memories).toHaveLength(1)
  })

  it('leaves refreshFailed out when the import worked', async () => {
    engramCli.run = async () => CONTEXT
    const result = await botTeamListEngramMemoryMethod.handler(
      { ...IDS, refresh: true },
      context(true, LINKED)
    )
    expect(result).not.toHaveProperty('refreshFailed')
  })
})
