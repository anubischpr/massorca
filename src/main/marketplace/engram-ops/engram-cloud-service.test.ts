import { describe, expect, it, vi } from 'vitest'
import {
  isSafeEngramProjectName,
  parseEngramEnrollment,
  parseEngramProjectNames
} from './engram-cloud-output'
import { createEngramCloudService, type EngramCloudDeps } from './engram-cloud-service'

const PROJECTS = [
  'Projects (2):',
  '  massorca                       2394 obs   1095 sessions   1388 prompts',
  '  notes                          12 obs     1 session      0 prompts',
  ''
].join('\n')
const TOKEN = 'cloud-secret-token'
const ENV = { ENGRAM_CLOUD_SERVER: 'https://engram.example.com', ENGRAM_CLOUD_TOKEN: TOKEN }

type Call = { args: readonly string[]; env?: Record<string, string> }

function setup(overrides: Partial<EngramCloudDeps> = {}, status = 'not enrolled (massorca)') {
  const calls: Call[] = []
  const saved: [string, number][] = []
  const run = vi.fn(
    async (_program: string, args: readonly string[], _t: number, env?: Record<string, string>) => {
      calls.push({ args, env })
      if (args[0] === 'projects') {
        return { code: 0, output: PROJECTS }
      }
      if (args[1] === 'status') {
        return { code: 0, output: `Server: x\nProject enrollment: ${status}\n` }
      }
      return { code: 0, output: 'ok' }
    }
  )
  const service = createEngramCloudService({
    resolveProgram: async () => 'C:\\engram\\engram.exe',
    run,
    cloudEnv: () => ENV,
    loadSyncTimes: async () => ({ notes: 1000 }),
    saveSyncTime: async (name, at) => {
      saved.push([name, at])
    },
    now: () => 5000,
    ...overrides
  })
  return { service, calls, saved, run }
}

describe('Engram cloud output', () => {
  it('reads project names from the list and nothing else', () => {
    expect(parseEngramProjectNames(PROJECTS)).toEqual(['massorca', 'notes'])
    expect(parseEngramProjectNames('Could not check for updates')).toEqual([])
  })

  it('reads the enrollment line', () => {
    expect(parseEngramEnrollment('Project enrollment: not enrolled (x)')).toBe(false)
    expect(parseEngramEnrollment('Project enrollment: enrolled (x)')).toBe(true)
    expect(parseEngramEnrollment('Project enrollment: not checked')).toBeNull()
    expect(parseEngramEnrollment('nothing here')).toBeNull()
  })

  it('refuses names that could read as an option', () => {
    expect(isSafeEngramProjectName('massorca')).toBe(true)
    expect(isSafeEngramProjectName('--all')).toBe(false)
    expect(isSafeEngramProjectName('')).toBe(false)
  })
})

describe('Engram cloud service', () => {
  it('lists projects with the time of their last sync', async () => {
    const { service, calls } = setup()
    expect(await service.listCloudProjects()).toEqual({
      ok: true,
      projects: [
        { name: 'massorca', lastSyncedAt: null },
        { name: 'notes', lastSyncedAt: 1000 }
      ]
    })
    expect(calls).toEqual([{ args: ['projects', 'list'], env: undefined }])
  })

  it('says why it cannot list', async () => {
    expect(await setup({ resolveProgram: async () => null }).service.listCloudProjects()).toEqual({
      ok: false,
      reason: 'not-installed'
    })
    expect(await setup({ cloudEnv: () => ({}) }).service.listCloudProjects()).toEqual({
      ok: false,
      reason: 'no-server'
    })
    const failing = setup({
      run: vi.fn(async () => {
        throw new Error('spawn failed')
      })
    })
    expect(await failing.service.listCloudProjects()).toEqual({ ok: false, reason: 'failed' })
  })

  it('enrolls with an argument list and the token only in the env', async () => {
    const { service, calls } = setup()
    expect(await service.enrollCloudProject('massorca')).toEqual({ ok: true })
    const enroll = calls.find((c) => c.args[1] === 'enroll')
    expect(enroll).toEqual({
      args: ['cloud', 'enroll', 'massorca', '--literal-project'],
      env: ENV
    })
    expect(calls.flatMap((c) => c.args).join(' ')).not.toContain(TOKEN)
  })

  it('enrolls an unenrolled project, then syncs it and remembers the time', async () => {
    const { service, calls, saved } = setup()
    expect(await service.syncCloudProject('massorca')).toEqual({ ok: true, lastSyncedAt: 5000 })
    expect(calls.map((c) => c.args.slice(0, 2).join(' '))).toEqual([
      'projects list',
      'cloud status',
      'cloud enroll',
      'sync --cloud'
    ])
    const sync = calls.at(-1)
    expect(sync).toEqual({
      args: ['sync', '--cloud', '--project', 'massorca', '--literal-project'],
      env: ENV
    })
    expect(calls.flatMap((c) => c.args).join(' ')).not.toContain(TOKEN)
    expect(saved).toEqual([['massorca', 5000]])
  })

  it('skips enrollment for an enrolled project', async () => {
    const { service, calls } = setup({}, 'enrolled (massorca)')
    await service.syncCloudProject('massorca')
    expect(calls.some((c) => c.args[1] === 'enroll')).toBe(false)
  })

  it('refuses names that are not Engram projects before running anything on them', async () => {
    const { service, calls } = setup()
    expect(await service.syncCloudProject('other')).toEqual({
      ok: false,
      reason: 'unknown-project'
    })
    expect(await service.enrollCloudProject('--all')).toEqual({
      ok: false,
      reason: 'unknown-project'
    })
    expect(calls.every((c) => c.args[0] === 'projects')).toBe(true)
  })

  it('does not run anything without a server', async () => {
    const { service, run } = setup({ cloudEnv: () => ({}) })
    expect(await service.syncCloudProject('massorca')).toEqual({ ok: false, reason: 'no-server' })
    expect(run).not.toHaveBeenCalled()
  })

  it('reports failures and timeouts without the program output', async () => {
    const failing = setup({
      run: vi.fn(async (_p: string, args: readonly string[]) =>
        args[0] === 'projects'
          ? { code: 0, output: PROJECTS }
          : { code: 1, output: `boom ${TOKEN} secret memory text` }
      )
    })
    const failed = await failing.service.syncCloudProject('massorca')
    expect(failed).toEqual({ ok: false, reason: 'failed' })
    expect(failing.saved).toEqual([])

    const slow = setup({
      run: vi.fn(async (_p: string, args: readonly string[]) =>
        args[0] === 'projects'
          ? { code: 0, output: PROJECTS }
          : args[1] === 'status'
            ? { code: 0, output: 'Project enrollment: enrolled (massorca)' }
            : { code: null, output: '' }
      )
    })
    expect(await slow.service.syncCloudProject('massorca')).toEqual({
      ok: false,
      reason: 'timed-out'
    })
  })
})
