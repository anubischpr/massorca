import type * as PrototypeClient from '@/runtime/runtime-prototype-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { PrototypeHostOutdatedError } from '@/runtime/runtime-prototype-client'
import { listPrototypeSetsFromAllHosts, prototypeTargetForSession } from './prototype-host-targets'

const mocks = vi.hoisted(() => ({ list: vi.fn(), environmentIds: ['env-1'] }))

vi.mock('@/lib/runtime-session-mirror-owners', () => ({
  getRuntimeSessionMirrorEnvironmentIds: () => mocks.environmentIds
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))
vi.mock('@/runtime/runtime-prototype-client', async (importOriginal) => ({
  ...(await importOriginal<typeof PrototypeClient>()),
  listPrototypeSetsOnHost: mocks.list
}))

function setOf(sessionId: string, requestId: string): PrototypeListedSet {
  return {
    requestId,
    sessionId,
    agent: 'claude',
    worktreeId: null,
    chatTitle: null,
    originalPrompt: 'p',
    createdAt: '2026-10-29T10:00:00.000Z',
    count: 2,
    directions: []
  }
}

describe('listPrototypeSetsFromAllHosts', () => {
  afterEach(() => vi.clearAllMocks())

  it('lists the local host and each paired runtime, and routes each chat back to its host', async () => {
    mocks.list.mockImplementation(async (target: { kind: string }) => ({
      sets: [target.kind === 'local' ? setOf('local-chat', 'r1') : setOf('remote-chat', 'r2')]
    }))
    const listed = await listPrototypeSetsFromAllHosts()
    expect(listed.sets.map((set) => set.requestId)).toEqual(['r1', 'r2'])
    expect(prototypeTargetForSession('local-chat')).toEqual({ kind: 'local' })
    expect(prototypeTargetForSession('remote-chat')).toEqual({
      kind: 'environment',
      environmentId: 'env-1'
    })
    expect(prototypeTargetForSession('never-listed')).toEqual({ kind: 'local' })
  })

  it('keeps the sets of a host that answered when another fails, and says why in the log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.list.mockImplementation(async (target: { kind: string }) => {
      if (target.kind === 'local') {
        return { sets: [setOf('local-chat', 'r1')] }
      }
      throw new PrototypeHostOutdatedError()
    })
    const listed = await listPrototypeSetsFromAllHosts()
    expect(listed).toMatchObject({ answered: true, onlyOutdated: true })
    expect(listed.sets).toHaveLength(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('runtime env-1'))
    warn.mockRestore()
  })

  it('reports no answer when every host fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.list.mockRejectedValue(new Error('offline'))
    const listed = await listPrototypeSetsFromAllHosts()
    expect(listed).toMatchObject({ answered: false, onlyOutdated: false, sets: [] })
    warn.mockRestore()
  })

  it('gathers the design systems each host lists', async () => {
    const system = (projectKey: string): Record<string, unknown> => ({
      projectKey,
      projectName: projectKey,
      status: 'detected',
      version: 1,
      tokenCount: 3,
      swatches: []
    })
    mocks.list.mockImplementation(async (target: { kind: string }) =>
      target.kind === 'local'
        ? { sets: [setOf('local-chat', 'r1')], designSystems: [system('a')] }
        : { sets: [] }
    )
    const listed = await listPrototypeSetsFromAllHosts()
    expect(listed.designSystems).toEqual([system('a')])
  })
})
