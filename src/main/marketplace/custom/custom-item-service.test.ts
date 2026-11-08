import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceCustomInstallEvent } from '../../../shared/marketplace-custom'
import type { LocalCommandProbe } from '../../ipc/preflight-command-exec'
import type { CustomInstallRun, CustomItemEnv } from './custom-item-env'
import { createCustomItemService } from './custom-item-service'
import { createCustomItemStore } from './custom-item-store'

const absent: LocalCommandProbe = { status: 'absent' }
const mytoolBinary: LocalCommandProbe = { status: 'available', binary: 'C:/tools/mytool.exe' }
const wingetBinary: LocalCommandProbe = { status: 'available', binary: 'C:/Windows/winget.exe' }

const toolDraft = {
  kind: 'tool',
  name: 'MyTool',
  checkCommand: 'mytool --version',
  install: { win32: 'winget install mytool' }
}

let dir = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'orca-custom-service-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

type EnvOverrides = Partial<
  Pick<CustomItemEnv, 'platform' | 'findCommand' | 'runCheck' | 'runInstall'>
>

/** A Windows machine with nothing installed, unless a test says otherwise. */
function makeEnv(overrides: EnvOverrides = {}): CustomItemEnv {
  let next = 0
  return {
    platform: 'win32',
    findCommand: async () => absent,
    runCheck: async () => ({ code: 0, timedOut: false }),
    runInstall: async () => ({ code: 0, timedOut: false }),
    store: createCustomItemStore(join(dir, 'custom.json')),
    now: () => 1_000,
    newId: () => `item-${++next}`,
    ...overrides
  }
}

function serviceWith(overrides?: EnvOverrides) {
  return createCustomItemService(makeEnv(overrides))
}

describe('add', () => {
  it('stores the item and reports what the check command finds', async () => {
    const service = serviceWith({ findCommand: async () => mytoolBinary })
    await expect(service.add(toolDraft)).resolves.toEqual({
      ok: true,
      item: {
        id: 'item-1',
        kind: 'tool',
        name: 'MyTool',
        checkCommand: ['mytool', '--version'],
        install: { win32: ['winget', 'install', 'mytool'] },
        createdAt: 1_000,
        presence: 'found',
        installedBy: 'outside'
      }
    })
  })

  it('refuses a second item with the same name and kind, ignoring case', async () => {
    const service = serviceWith()
    await service.add(toolDraft)
    await expect(service.add({ ...toolDraft, name: 'mytool' })).resolves.toEqual({
      ok: false,
      reason: 'duplicate'
    })
    await expect(service.list()).resolves.toHaveLength(1)
  })

  it('allows the same name for a different kind', async () => {
    const service = serviceWith()
    await service.add(toolDraft)
    await expect(
      service.add({ kind: 'agent', name: 'MyTool', checkCommand: 'mytool-agent --version' })
    ).resolves.toMatchObject({ ok: true })
  })

  it('refuses input the board may not store, and writes nothing', async () => {
    const service = serviceWith()
    await expect(
      service.add({ ...toolDraft, checkCommand: 'mytool --version | tee log' })
    ).resolves.toEqual({ ok: false, reason: 'invalid-input' })
    await expect(service.list()).resolves.toEqual([])
  })

  it('keeps items across service instances, because the file is the record', async () => {
    await serviceWith().add(toolDraft)
    await expect(serviceWith().list()).resolves.toMatchObject([{ name: 'MyTool' }])
  })

  it('keeps both items when two adds run at once', async () => {
    const service = serviceWith()
    await Promise.all([
      service.add({ kind: 'tool', name: 'One', checkCommand: 'one -v' }),
      service.add({ kind: 'tool', name: 'Two', checkCommand: 'two -v' })
    ])
    const names = (await service.list()).map((item) => item.name).sort()
    expect(names).toEqual(['One', 'Two'])
  })

  it('answers failed, not a rejection, when the file cannot be written', async () => {
    const env = makeEnv()
    const service = createCustomItemService({
      ...env,
      store: {
        read: () => [],
        write: () => {
          throw new Error('EPERM')
        }
      }
    })
    await expect(service.add(toolDraft)).resolves.toEqual({ ok: false, reason: 'failed' })
  })
})

describe('list', () => {
  it('reports found outside MassOrca, missing, and unverifiable, and a skill as unverifiable', async () => {
    const probes = new Map<string, LocalCommandProbe>([
      ['found', { status: 'available', binary: 'C:/tools/found.exe' }],
      ['slow', { status: 'timeout', binary: 'slow' }]
    ])
    const service = serviceWith({ findCommand: async (command) => probes.get(command) ?? absent })
    await service.add({ kind: 'tool', name: 'Found', checkCommand: 'found --version' })
    await service.add({ kind: 'tool', name: 'Gone', checkCommand: 'gone --version' })
    await service.add({ kind: 'tool', name: 'Slow', checkCommand: 'slow --version' })
    await service.add({
      kind: 'skill',
      name: 'Review',
      skillUrl: 'https://example.com/skills/review'
    })
    const listed = await service.list()
    const named = (name: string) => listed.find((item) => item.name === name)
    expect(named('Found')).toMatchObject({ presence: 'found', installedBy: 'outside' })
    expect(named('Gone')).toMatchObject({ presence: 'missing' })
    expect(named('Gone')).not.toHaveProperty('installedBy')
    expect(named('Slow')).toMatchObject({ presence: 'unverifiable' })
    expect(named('Review')).toMatchObject({ presence: 'unverifiable' })
  })
})

describe('remove', () => {
  it('forgets the item, keeps the others, and reports the removed item as unverifiable', async () => {
    const service = serviceWith()
    await service.add(toolDraft)
    await service.add({ kind: 'tool', name: 'Other', checkCommand: 'other -v' })
    await expect(service.remove({ id: 'item-1' })).resolves.toMatchObject({
      ok: true,
      item: { id: 'item-1', name: 'MyTool', presence: 'unverifiable' }
    })
    await expect(service.list()).resolves.toMatchObject([{ name: 'Other' }])
  })

  it('answers not-found for an unknown id and invalid-input for a bad one', async () => {
    const service = serviceWith()
    await expect(service.remove({ id: 'nope' })).resolves.toEqual({
      ok: false,
      reason: 'not-found'
    })
    await expect(service.remove({})).resolves.toEqual({ ok: false, reason: 'invalid-input' })
  })
})

describe('install', () => {
  it('streams the output, re-detects the item, and records it as installed by MassOrca', async () => {
    let installed = false
    const runInstall = vi.fn(
      async (
        _argv: readonly string[],
        onLine: (line: string) => void
      ): Promise<CustomInstallRun> => {
        onLine('Downloading mytool')
        installed = true
        return { code: 0, timedOut: false }
      }
    )
    const service = serviceWith({
      findCommand: async (command) => {
        if (command === 'winget') {
          return wingetBinary
        }
        return installed ? mytoolBinary : absent
      },
      runInstall
    })
    await service.add(toolDraft)
    const events: MarketplaceCustomInstallEvent[] = []
    const result = await service.install({ id: 'item-1' }, (event) => events.push(event))
    expect(runInstall).toHaveBeenCalledWith(
      ['C:/Windows/winget.exe', 'install', 'mytool'],
      expect.any(Function)
    )
    expect(events).toEqual([
      { id: 'item-1', status: 'running' },
      { id: 'item-1', status: 'running', logLine: 'Downloading mytool' },
      { id: 'item-1', status: 'done' }
    ])
    expect(result).toMatchObject({ ok: true, item: { presence: 'found', installedBy: 'massorca' } })
    await expect(service.list()).resolves.toMatchObject([{ installedBy: 'massorca' }])
  })

  it('refuses a skill, and an item with no install command for this platform', async () => {
    const runInstall = vi.fn(async () => ({ code: 0, timedOut: false }))
    const service = serviceWith({ runInstall })
    await service.add({
      kind: 'skill',
      name: 'Review',
      skillUrl: 'https://example.com/skills/review'
    })
    await service.add({
      kind: 'tool',
      name: 'MacOnly',
      checkCommand: 'macapp -v',
      install: { darwin: 'brew install macapp' }
    })
    await expect(service.install({ id: 'item-1' }, () => {})).resolves.toEqual({
      ok: false,
      reason: 'unsupported-platform'
    })
    await expect(service.install({ id: 'item-2' }, () => {})).resolves.toEqual({
      ok: false,
      reason: 'unsupported-platform'
    })
    expect(runInstall).not.toHaveBeenCalled()
  })

  it('answers not-found for an unknown id and invalid-input for a bad one', async () => {
    const service = serviceWith()
    await expect(service.install({ id: 'nope' }, () => {})).resolves.toEqual({
      ok: false,
      reason: 'not-found'
    })
    await expect(service.install({ id: 7 }, () => {})).resolves.toEqual({
      ok: false,
      reason: 'invalid-input'
    })
  })

  it('fails with the exit code when the install exits non-zero, and records nothing', async () => {
    const service = serviceWith({
      findCommand: async (command) => (command === 'winget' ? wingetBinary : absent),
      runInstall: async (_argv, onLine) => {
        onLine('Access is denied.')
        return { code: 1, timedOut: false }
      }
    })
    await service.add(toolDraft)
    const events: MarketplaceCustomInstallEvent[] = []
    await expect(service.install({ id: 'item-1' }, (event) => events.push(event))).resolves.toEqual(
      { ok: false, reason: 'failed' }
    )
    expect(events.at(-1)).toEqual({
      id: 'item-1',
      status: 'failed',
      logLine: 'The install command ended with code 1.'
    })
    const [listed] = await service.list()
    expect(listed).toMatchObject({ presence: 'missing' })
    expect(listed).not.toHaveProperty('installedBy')
  })

  it('fails on a timeout', async () => {
    const service = serviceWith({
      findCommand: async (command) => (command === 'winget' ? wingetBinary : absent),
      runInstall: async () => ({ code: null, timedOut: true })
    })
    await service.add(toolDraft)
    const events: MarketplaceCustomInstallEvent[] = []
    await service.install({ id: 'item-1' }, (event) => events.push(event))
    expect(events.at(-1)).toEqual({
      id: 'item-1',
      status: 'failed',
      logLine: 'The install command timed out.'
    })
  })

  it('fails when the install command cannot be started', async () => {
    const service = serviceWith({
      findCommand: async (command) => (command === 'winget' ? wingetBinary : absent),
      runInstall: async () => {
        throw new Error('spawn winget ENOENT')
      }
    })
    await service.add(toolDraft)
    const events: MarketplaceCustomInstallEvent[] = []
    await expect(service.install({ id: 'item-1' }, (event) => events.push(event))).resolves.toEqual(
      { ok: false, reason: 'failed' }
    )
    expect(events.at(-1)).toEqual({
      id: 'item-1',
      status: 'failed',
      logLine: 'The install command could not be started.'
    })
  })

  it('fails, without running anything, when the install program is not found', async () => {
    const runInstall = vi.fn(async () => ({ code: 0, timedOut: false }))
    const service = serviceWith({ runInstall })
    await service.add(toolDraft)
    const events: MarketplaceCustomInstallEvent[] = []
    await expect(service.install({ id: 'item-1' }, (event) => events.push(event))).resolves.toEqual(
      { ok: false, reason: 'failed' }
    )
    expect(events.at(-1)).toEqual({
      id: 'item-1',
      status: 'failed',
      logLine: 'The install program was not found or could not run.'
    })
    expect(runInstall).not.toHaveBeenCalled()
  })

  it('fails when the check still does not find the app after a clean install', async () => {
    const service = serviceWith({
      findCommand: async (command) => (command === 'winget' ? wingetBinary : absent),
      runInstall: async () => ({ code: 0, timedOut: false })
    })
    await service.add(toolDraft)
    const events: MarketplaceCustomInstallEvent[] = []
    await expect(service.install({ id: 'item-1' }, (event) => events.push(event))).resolves.toEqual(
      { ok: false, reason: 'failed' }
    )
    expect(events.at(-1)).toEqual({
      id: 'item-1',
      status: 'failed',
      logLine: 'The check command still does not find it.'
    })
    const [listed] = await service.list()
    expect(listed).toMatchObject({ presence: 'missing' })
    expect(listed).not.toHaveProperty('installedBy')
  })

  it('runs a program path the person typed as typed', async () => {
    let installed = false
    const runInstall = vi.fn(async () => {
      installed = true
      return { code: 0, timedOut: false }
    })
    const service = serviceWith({
      findCommand: async (command) => (installed && command === 'mytool' ? mytoolBinary : absent),
      runInstall
    })
    await service.add({
      kind: 'tool',
      name: 'MyTool',
      checkCommand: 'mytool --version',
      install: { win32: 'C:\\Tools\\setup.exe /quiet' }
    })
    await expect(service.install({ id: 'item-1' }, () => {})).resolves.toMatchObject({ ok: true })
    expect(runInstall).toHaveBeenCalledWith(
      ['C:\\Tools\\setup.exe', '/quiet'],
      expect.any(Function)
    )
  })

  it('refuses a second run of an item that is already installing', async () => {
    let release = (): void => {}
    const gate = new Promise<void>((resolve) => {
      release = () => resolve()
    })
    let installed = false
    const service = serviceWith({
      findCommand: async (command) => {
        if (command === 'winget') {
          return wingetBinary
        }
        return installed ? mytoolBinary : absent
      },
      runInstall: async () => {
        await gate
        installed = true
        return { code: 0, timedOut: false }
      }
    })
    await service.add(toolDraft)
    const first = service.install({ id: 'item-1' }, () => {})
    await expect(service.install({ id: 'item-1' }, () => {})).resolves.toEqual({
      ok: false,
      reason: 'failed'
    })
    release()
    await expect(first).resolves.toMatchObject({
      ok: true,
      item: { installedBy: 'massorca' }
    })
  })
})

describe('unreadable file', () => {
  it('rejects the list and changes nothing when the file cannot be read', async () => {
    const file = join(dir, 'custom.json')
    writeFileSync(file, '{ broken')
    const service = serviceWith()
    await expect(service.list()).rejects.toThrow('cannot be read')
    await expect(service.add(toolDraft)).resolves.toEqual({ ok: false, reason: 'failed' })
    await expect(service.remove({ id: 'item-1' })).resolves.toEqual({
      ok: false,
      reason: 'failed'
    })
    await expect(service.install({ id: 'item-1' }, () => {})).resolves.toEqual({
      ok: false,
      reason: 'failed'
    })
    expect(readFileSync(file, 'utf8')).toBe('{ broken')
  })
})
