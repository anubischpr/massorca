import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { callMock, listEnvironmentsMock } = vi.hoisted(() => ({
  callMock: vi.fn(),
  listEnvironmentsMock: vi.fn(() => [] as { id: string; name: string }[])
}))

vi.mock('../runtime-client', async () => {
  class RuntimeClient {
    readonly isRemote = false
    call = callMock
    getCliStatus = vi.fn()
    openOrca = vi.fn()
  }
  // Why: the real error classes, so format.ts keeps each CLI error code.
  const { RuntimeClientError, RuntimeRpcFailureError } = await import('../runtime/types.js')
  return {
    RuntimeClient,
    RuntimeClientError,
    RuntimeRpcFailureError,
    getDefaultUserDataPath: () => '/tmp/orca-user-data'
  }
})

vi.mock('../runtime/environments', () => ({
  addEnvironmentFromPairingCode: vi.fn(),
  listEnvironments: listEnvironmentsMock,
  removeEnvironment: vi.fn(),
  resolveEnvironment: vi.fn()
}))

import { main } from '../index'
import { okFixture } from '../test-fixtures'

const DIGEST = 'c'.repeat(64)

function tarEntry(name: string, body: Buffer): Buffer {
  const header = Buffer.alloc(512)
  header.write(name, 0)
  header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124)
  header.write('0', 156)
  header.write('ustar', 257)
  return Buffer.concat([header, body, Buffer.alloc((512 - (body.length % 512)) % 512)])
}

function packageArchive(overrides: Record<string, unknown> = {}): Buffer {
  const manifest = {
    schemaVersion: 1,
    packageId: 'pkg-caveman',
    versionId: 'v1',
    name: 'caveman',
    description: '',
    createdAt: '2026-01-01T00:00:00Z',
    files: [
      {
        path: 'SKILL.md',
        size: 5,
        executable: false,
        classification: 'text',
        sha256: 'a'.repeat(64),
        identitySha256: 'b'.repeat(64)
      }
    ],
    packageDigest: DIGEST,
    ...overrides
  }
  return gzipSync(
    Buffer.concat([
      tarEntry('manifest.json', Buffer.from(JSON.stringify(manifest))),
      tarEntry('skill/SKILL.md', Buffer.from('hello')),
      Buffer.alloc(1024)
    ])
  )
}

function managedInstall(overrides: Record<string, unknown> = {}) {
  return {
    name: 'caveman',
    packageId: 'pkg-caveman',
    versionId: 'v1',
    packageDigest: DIGEST,
    scope: 'global',
    destinationIdentity: 'dest',
    destination: { scope: 'global' },
    providers: ['claude', 'codex'],
    installedAt: '2026-01-01T00:00:00Z',
    state: 'unchanged',
    ...overrides
  }
}

const WSL_DESTINATION = {
  scope: 'global',
  executionTarget: { kind: 'wsl', distro: 'Ubuntu' }
}

function installResult(overrides: Record<string, unknown> = {}) {
  return {
    operationId: 'op',
    status: 'installed',
    name: 'caveman',
    packageDigest: DIGEST,
    placements: [
      {
        provider: 'claude',
        path: '/home/u/.claude/skills/caveman',
        topology: 'independent-copy',
        status: 'installed'
      }
    ],
    ...overrides
  }
}

type Route = (params: unknown) => unknown

function route(routes: Record<string, Route>) {
  callMock.mockImplementation(async (method: string, params: unknown) => {
    const handler = routes[method]
    if (!handler) {
      throw new Error(`unexpected RPC ${method}`)
    }
    return okFixture(`req_${method}`, handler(params))
  })
}

function callsOf(method: string): unknown[][] {
  return callMock.mock.calls.filter((call) => call[0] === method)
}

function printed(): string {
  return vi
    .mocked(console.log)
    .mock.calls.map((call) => String(call[0]))
    .join('\n')
}

function errors(): string {
  return vi
    .mocked(console.error)
    .mock.calls.map((call) => String(call[0]))
    .join('\n')
}

function uploadRoutes(): Record<string, Route> {
  return {
    'skills.beginUpload': () => ({
      uploadId: 'up-1',
      chunkBytes: 256 * 1024,
      acknowledgedOffset: 0
    }),
    'skills.uploadChunk': (params) => {
      const { offset, bytesBase64 } = params as { offset: number; bytesBase64: string }
      return { acknowledgedOffset: offset + Buffer.from(bytesBase64, 'base64').length }
    },
    'skills.commitUpload': () => ({ uploadId: 'up-1' })
  }
}

describe('orca marketplace skills CLI', () => {
  let scratch: string
  let archivePath: string

  beforeEach(async () => {
    vi.restoreAllMocks()
    callMock.mockReset()
    delete process.env.ORCA_PAIRING_CODE
    delete process.env.ORCA_ENVIRONMENT
    process.exitCode = undefined
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    scratch = await mkdtemp(join(tmpdir(), 'orca-cli-skills-'))
    archivePath = join(scratch, 'caveman.tar.gz')
    await writeFile(archivePath, packageArchive())
  })

  afterEach(async () => {
    await rm(scratch, { recursive: true, force: true })
  })

  describe('list', () => {
    const installs = [
      managedInstall(),
      managedInstall({
        name: 'wsl-only',
        destination: WSL_DESTINATION,
        providers: undefined
      }),
      managedInstall({
        name: 'remote-only',
        destination: { scope: 'global', executionTarget: { kind: 'ssh', connectionId: 'box-1' } }
      }),
      managedInstall({ name: 'repo-copy', scope: 'workspace' })
    ]

    it('lists every global install with agent names and tags other machines', async () => {
      route({ 'skills.listManagedInstalls': () => installs })

      await main(['marketplace', 'skills', 'list'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('skills.listManagedInstalls', undefined)
      expect(printed()).toContain('caveman: unchanged; agents: Claude Code, Codex')
      expect(printed()).toContain('wsl-only [WSL Ubuntu]: unchanged; agents: every detected agent')
      expect(printed()).toContain('remote-only [SSH box-1]')
      expect(printed()).not.toContain('repo-copy')
      expect(process.exitCode).toBeUndefined()
    })

    it('keeps one distro to its own installs with --host wsl:<distro>', async () => {
      route({ 'skills.listManagedInstalls': () => installs })

      await main(['marketplace', 'skills', 'list', '--host', 'wsl:Ubuntu', '--json'], '/tmp/repo')

      const rows = JSON.parse(printed()).result
      expect(rows.map((row: { name: string }) => row.name)).toEqual(['wsl-only'])
      expect(rows[0].agents).toBeNull()
    })

    it('returns the agents holding each skill in --json', async () => {
      route({ 'skills.listManagedInstalls': () => installs })

      await main(['marketplace', 'skills', 'list', '--host', 'local', '--json'], '/tmp/repo')

      const rows = JSON.parse(printed()).result
      expect(rows).toHaveLength(1)
      expect(rows[0].agents).toEqual([
        { id: 'claude', name: 'Claude Code' },
        { id: 'codex', name: 'Codex' }
      ])
    })

    it('resolves an SSH host through the connected runtime and filters to it', async () => {
      route({
        'ssh.listTargetSummaries': () => ({ targets: [{ id: 'box-1', label: 'VPS' }] }),
        'skills.listManagedInstalls': () => installs
      })

      await main(['marketplace', 'skills', 'list', '--host', 'ssh:VPS', '--json'], '/tmp/repo')

      const rows = JSON.parse(printed()).result
      expect(rows.map((row: { name: string }) => row.name)).toEqual(['remote-only'])
    })

    it('rejects a host spelling it does not know, and a wsl: host with no distro', async () => {
      await main(['marketplace', 'skills', 'list', '--host', 'bogus'], '/tmp/repo')
      expect(errors()).toContain('Invalid --host value: bogus')
      await main(['marketplace', 'skills', 'list', '--host', 'wsl:'], '/tmp/repo')
      expect(errors()).toContain('Missing distro name')

      expect(callMock).not.toHaveBeenCalled()
      expect(process.exitCode).toBe(1)
    })
  })

  describe('show', () => {
    it('prints the package and the folder paths on a distro', async () => {
      route({
        'skills.listManagedInstalls': () => [managedInstall({ destination: WSL_DESTINATION })],
        'skills.discover': () => ({
          skills: [
            {
              id: 's1',
              name: 'caveman',
              providers: ['claude', 'agent-skills'],
              directoryPath: '/home/u/.claude/skills/caveman',
              skillFilePath: '/home/u/.claude/skills/caveman/SKILL.md'
            },
            {
              id: 's2',
              name: 'other',
              providers: ['codex'],
              directoryPath: '/x/other',
              skillFilePath: '/x/other/SKILL.md'
            }
          ],
          sources: [],
          scannedAt: 1
        })
      })

      await main(['marketplace', 'skills', 'show', 'caveman', '--host', 'wsl:Ubuntu'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('skills.discover', {
        runtime: 'wsl',
        wslDistro: 'Ubuntu',
        names: ['caveman'],
        sourceKinds: ['home'],
        refresh: true
      })
      const out = printed()
      expect(out).toContain('caveman on WSL: Ubuntu')
      expect(out).toContain(`digest: ${DIGEST}`)
      expect(out).toContain('folder: /home/u/.claude/skills/caveman')
      expect(out).toContain('file: /home/u/.claude/skills/caveman/SKILL.md')
      expect(out).toContain('read by: Claude Code, the shared agents folder')
      expect(out).not.toContain('/x/other')
    })

    it('says folders are unknown on an SSH host without calling discovery', async () => {
      route({
        'ssh.listTargetSummaries': () => ({ targets: [{ id: 'box-1', label: 'VPS' }] }),
        'skills.listManagedInstalls': () => [
          managedInstall({
            destination: {
              scope: 'global',
              executionTarget: { kind: 'ssh', connectionId: 'box-1' }
            }
          })
        ]
      })

      await main(
        ['marketplace', 'skills', 'show', 'caveman', '--host', 'ssh:box-1', '--json'],
        '/tmp/repo'
      )

      const result = JSON.parse(printed()).result
      expect(result.install.name).toBe('caveman')
      expect(result.copies).toBeNull()
      expect(callsOf('skills.discover')).toHaveLength(0)
    })

    it('fails when the skill is nowhere on the host', async () => {
      route({
        'skills.listManagedInstalls': () => [],
        'skills.discover': () => ({ skills: [], sources: [], scannedAt: 1 })
      })

      await main(['marketplace', 'skills', 'show', 'caveman'], '/tmp/repo')

      expect(process.exitCode).toBe(1)
      expect(errors()).toContain('caveman is not installed on this host')
    })
  })

  describe('install', () => {
    it('uploads the package file, then installs it for the picked agents on a distro', async () => {
      route({ ...uploadRoutes(), 'skills.install': () => installResult() })

      await main(
        [
          'marketplace',
          'skills',
          'install',
          '--file',
          archivePath,
          '--agents',
          'claude,codex',
          '--conflict',
          'replace-unmodified',
          '--host',
          'wsl:Ubuntu',
          '--json'
        ],
        '/tmp/repo'
      )

      const bytes = packageArchive()
      expect(callsOf('skills.beginUpload')[0]?.[1]).toEqual({
        package: expect.objectContaining({
          packageId: 'pkg-caveman',
          versionId: 'v1',
          packageDigest: DIGEST,
          compressedBytes: bytes.length,
          archiveSha256: expect.stringMatching(/^[a-f0-9]{64}$/)
        })
      })
      expect(callsOf('skills.uploadChunk')[0]?.[1]).toEqual({
        uploadId: 'up-1',
        offset: 0,
        bytesBase64: bytes.toString('base64')
      })
      expect(callsOf('skills.commitUpload')[0]?.[1]).toEqual({ uploadId: 'up-1' })
      expect(callsOf('skills.install')[0]?.[1]).toEqual({
        operationId: expect.any(String),
        package: expect.objectContaining({ packageId: 'pkg-caveman' }),
        ingress: { kind: 'staged-upload', uploadId: 'up-1' },
        destination: WSL_DESTINATION,
        providers: ['claude', 'codex'],
        conflictResolution: 'replace-unmodified'
      })
      expect(JSON.parse(printed()).result.status).toBe('installed')
      expect(printed()).not.toContain(bytes.toString('base64'))
      expect(process.exitCode).toBeUndefined()
    })

    it('sends no providers when --agents is absent, and an empty list for none', async () => {
      route({ ...uploadRoutes(), 'skills.install': () => installResult() })

      await main(['marketplace', 'skills', 'install', '--file', archivePath], '/tmp/repo')
      await main(
        ['marketplace', 'skills', 'install', '--file', archivePath, '--agents', 'none'],
        '/tmp/repo'
      )

      const [first, second] = callsOf('skills.install').map(
        (call) => call[1] as Record<string, unknown>
      )
      expect(first).not.toHaveProperty('providers')
      expect(first?.destination).toEqual({ scope: 'global' })
      expect(second?.providers).toEqual([])
    })

    it('streams a larger package in chunks of the size the host asked for', async () => {
      route({
        ...uploadRoutes(),
        'skills.beginUpload': () => ({ uploadId: 'up-1', chunkBytes: 64, acknowledgedOffset: 0 }),
        'skills.install': () => installResult()
      })

      await main(['marketplace', 'skills', 'install', '--file', archivePath], '/tmp/repo')

      const offsets = callsOf('skills.uploadChunk').map(
        (call) => (call[1] as { offset: number }).offset
      )
      expect(offsets.length).toBeGreaterThan(1)
      expect(offsets[0]).toBe(0)
      expect(offsets[1]).toBe(64)
      expect(process.exitCode).toBeUndefined()
    })

    it('exits 1 on a conflict and names the --conflict choices', async () => {
      route({
        ...uploadRoutes(),
        'skills.install': () =>
          installResult({ status: 'conflict', placements: [], conflict: { kind: 'modified' } })
      })

      await main(['marketplace', 'skills', 'install', '--file', archivePath], '/tmp/repo')

      expect(process.exitCode).toBe(1)
      expect(printed()).toContain('--conflict replace-and-discard-local')
    })

    it('refuses an SSH host before uploading anything', async () => {
      route({ 'ssh.listTargetSummaries': () => ({ targets: [{ id: 'box-1', label: 'VPS' }] }) })

      await main(
        ['marketplace', 'skills', 'install', '--file', archivePath, '--host', 'ssh:box-1'],
        '/tmp/repo'
      )

      expect(callsOf('skills.beginUpload')).toHaveLength(0)
      expect(process.exitCode).toBe(1)
      expect(errors()).toContain('SSH')
    })

    it('refuses an unknown agent, a missing flag and a non-package file before any RPC', async () => {
      const notPackage = join(scratch, 'plain.txt')
      await writeFile(notPackage, 'nope')

      await main(
        ['marketplace', 'skills', 'install', '--file', archivePath, '--agents', 'pi'],
        '/tmp/repo'
      )
      expect(errors()).toContain('Unknown agent "pi"')
      await main(['marketplace', 'skills', 'install'], '/tmp/repo')
      expect(errors()).toContain('--package <id> --version <id>')
      await main(
        [
          'marketplace',
          'skills',
          'install',
          '--file',
          archivePath,
          '--package',
          'p',
          '--version',
          'v'
        ],
        '/tmp/repo'
      )
      expect(errors()).toContain('not both')
      await main(['marketplace', 'skills', 'install', '--file', notPackage], '/tmp/repo')
      expect(errors()).toContain('not a MassOrca skill package')
      await main(
        ['marketplace', 'skills', 'install', '--file', archivePath, '--conflict', 'maybe'],
        '/tmp/repo'
      )
      expect(errors()).toContain('Unknown --conflict "maybe"')

      expect(callMock).not.toHaveBeenCalled()
      expect(process.exitCode).toBe(1)
    })

    it('installs a catalog version on an SSH host through the desktop grant', async () => {
      route({
        'ssh.listTargetSummaries': () => ({ targets: [{ id: 'box-1', label: 'VPS' }] }),
        'skills.installPackageVersion': () => installResult({ status: 'installed' })
      })

      await main(
        [
          'marketplace',
          'skills',
          'install',
          '--package',
          'pkg-caveman',
          '--version',
          'v1',
          '--agents',
          'codex',
          '--host',
          'ssh:box-1',
          '--json'
        ],
        '/tmp/repo'
      )

      expect(callsOf('skills.installPackageVersion')[0]?.[1]).toEqual({
        operationId: expect.any(String),
        packageId: 'pkg-caveman',
        versionId: 'v1',
        destination: {
          scope: 'global',
          executionTarget: { kind: 'ssh', connectionId: 'box-1' }
        },
        providers: ['codex']
      })
      expect(callsOf('skills.beginUpload')).toHaveLength(0)
      expect(JSON.parse(printed()).result.status).toBe('installed')
      expect(process.exitCode).toBeUndefined()
    })

    it('exits 1 with the host message when the catalog grant is refused', async () => {
      route({
        'skills.installPackageVersion': () => ({
          status: 'unavailable',
          message: 'Skill Cloud service is unavailable'
        })
      })

      await main(
        ['marketplace', 'skills', 'install', '--package', 'pkg-caveman', '--version', 'v1'],
        '/tmp/repo'
      )

      expect(process.exitCode).toBe(1)
      expect(errors()).toContain('unavailable (Skill Cloud service is unavailable)')
    })

    it('cancels the upload when a chunk fails', async () => {
      route({
        ...uploadRoutes(),
        'skills.uploadChunk': () => {
          throw new Error('disk full')
        },
        'skills.cancelUpload': () => ({})
      })

      await main(['marketplace', 'skills', 'install', '--file', archivePath], '/tmp/repo')

      expect(callsOf('skills.cancelUpload')[0]?.[1]).toEqual({ uploadId: 'up-1' })
      expect(callsOf('skills.install')).toHaveLength(0)
      expect(process.exitCode).toBe(1)
    })
  })

  describe('agents', () => {
    function agentRoutes(afterProviders: string[]) {
      let listed = 0
      return {
        ...uploadRoutes(),
        'skills.listManagedInstalls': () => {
          listed += 1
          return [
            managedInstall({ providers: listed === 1 ? ['claude', 'codex'] : afterProviders })
          ]
        },
        'skills.install': () =>
          installResult({
            status: 'updated',
            placements: [
              {
                provider: 'claude',
                path: '/home/u/.claude/skills/caveman',
                topology: 'independent-copy',
                status: 'removed'
              }
            ]
          }),
        'skills.discover': () => ({
          skills: [
            {
              id: 's1',
              name: 'caveman',
              providers: ['agent-skills', 'codex'],
              directoryPath: '/home/u/.agents/skills/caveman',
              skillFilePath: '/home/u/.agents/skills/caveman/SKILL.md'
            }
          ],
          sources: [],
          scannedAt: 1
        })
      }
    }

    it('reinstalls the same package with the new list and shows the copy removed', async () => {
      route(agentRoutes(['codex']))

      await main(
        [
          'marketplace',
          'skills',
          'agents',
          'caveman',
          '--agents',
          'codex',
          '--file',
          archivePath,
          '--json'
        ],
        '/tmp/repo'
      )

      expect(callsOf('skills.install')[0]?.[1]).toEqual(
        expect.objectContaining({
          ingress: { kind: 'staged-upload', uploadId: 'up-1' },
          destination: { scope: 'global' },
          providers: ['codex']
        })
      )
      const result = JSON.parse(printed()).result
      expect(result.install.agents).toEqual([{ id: 'codex', name: 'Codex' }])
      expect(result.reconcile.placements[0]).toEqual(
        expect.objectContaining({ provider: 'claude', status: 'removed' })
      )
      expect(result.copies.map((copy: { directoryPath: string }) => copy.directoryPath)).toEqual([
        '/home/u/.agents/skills/caveman'
      ])
      expect(process.exitCode).toBeUndefined()
    })

    it('re-places the installed catalog version without a package file', async () => {
      const routes = agentRoutes(['codex'])
      route({ ...routes, 'skills.installPackageVersion': routes['skills.install'] })

      await main(['marketplace', 'skills', 'agents', 'caveman', '--agents', 'codex'], '/tmp/repo')

      expect(callsOf('skills.installPackageVersion')[0]?.[1]).toEqual(
        expect.objectContaining({
          packageId: 'pkg-caveman',
          versionId: 'v1',
          destination: { scope: 'global' },
          providers: ['codex']
        })
      )
      expect(callsOf('skills.beginUpload')).toHaveLength(0)
      expect(printed()).toContain('Claude Code: removed (/home/u/.claude/skills/caveman)')
      expect(process.exitCode).toBeUndefined()
    })

    it('prints the removed placement in the human output', async () => {
      route(agentRoutes(['codex']))

      await main(
        ['marketplace', 'skills', 'agents', 'caveman', '--agents', 'codex', '--file', archivePath],
        '/tmp/repo'
      )

      expect(printed()).toContain('Claude Code: removed (/home/u/.claude/skills/caveman)')
      expect(printed()).toContain('agents: Codex')
    })

    it('exits 1 when the host did not record the new list', async () => {
      route(agentRoutes(['claude', 'codex']))

      await main(
        ['marketplace', 'skills', 'agents', 'caveman', '--agents', 'codex', '--file', archivePath],
        '/tmp/repo'
      )

      expect(process.exitCode).toBe(1)
    })

    it('refuses a file that is another package version than the installed one', async () => {
      route(agentRoutes(['codex']))
      await writeFile(archivePath, packageArchive({ versionId: 'v2' }))

      await main(
        ['marketplace', 'skills', 'agents', 'caveman', '--agents', 'codex', '--file', archivePath],
        '/tmp/repo'
      )

      expect(callsOf('skills.beginUpload')).toHaveLength(0)
      expect(process.exitCode).toBe(1)
      expect(errors()).toContain('different package or version')
    })

    it('needs --agents, and a skill that is installed on the host', async () => {
      route({ 'skills.listManagedInstalls': () => [] })

      await main(['marketplace', 'skills', 'agents', 'caveman', '--file', archivePath], '/tmp/repo')
      expect(errors()).toContain('--agents needs agent ids')

      await main(
        ['marketplace', 'skills', 'agents', 'caveman', '--agents', 'codex', '--file', archivePath],
        '/tmp/repo'
      )
      expect(errors()).toContain('caveman is not installed on this host')
      expect(callsOf('skills.beginUpload')).toHaveLength(0)
    })
  })

  describe('uninstall', () => {
    it('still removes from the connected host with a plain global destination', async () => {
      route({ 'skills.removeInstall': () => installResult({ status: 'removed', placements: [] }) })

      await main(['marketplace', 'skills', 'uninstall', 'caveman'], '/tmp/repo')

      expect(callsOf('skills.removeInstall')[0]?.[1]).toEqual({
        operationId: expect.any(String),
        name: 'caveman',
        destination: { scope: 'global' }
      })
      expect(printed()).toContain('caveman: removed')
      expect(process.exitCode).toBeUndefined()
    })

    it('targets a distro, or an SSH host, through the destination', async () => {
      route({
        'ssh.listTargetSummaries': () => ({ targets: [{ id: 'box-1', label: 'VPS' }] }),
        'skills.removeInstall': () => installResult({ status: 'removed', placements: [] })
      })

      await main(
        [
          'marketplace',
          'skills',
          'uninstall',
          'caveman',
          '--host',
          'wsl:Ubuntu',
          '--conflict',
          'cancel'
        ],
        '/tmp/repo'
      )
      await main(
        ['marketplace', 'skills', 'uninstall', 'caveman', '--host', 'ssh:VPS'],
        '/tmp/repo'
      )

      const [distro, ssh] = callsOf('skills.removeInstall').map((call) => call[1])
      expect(distro).toEqual(
        expect.objectContaining({ destination: WSL_DESTINATION, conflictResolution: 'cancel' })
      )
      expect(ssh).toEqual(
        expect.objectContaining({
          destination: { scope: 'global', executionTarget: { kind: 'ssh', connectionId: 'box-1' } }
        })
      )
    })

    it('exits 1 when the host does not report the skill removed', async () => {
      route({ 'skills.removeInstall': () => installResult({ status: 'conflict', placements: [] }) })

      await main(['marketplace', 'skills', 'uninstall', 'caveman'], '/tmp/repo')

      expect(process.exitCode).toBe(1)
    })
  })

  it('leaves --host wsl:<distro> refused on commands that are not about a distro', async () => {
    await main(
      ['worktree', 'create', '--name', 'x', '--project', 'p', '--host', 'wsl:Ubuntu'],
      '/tmp/repo'
    )

    expect(process.exitCode).toBe(1)
    expect(errors()).toContain('Invalid --host value: wsl:Ubuntu')
    expect(callsOf('skills.listManagedInstalls')).toHaveLength(0)
  })
})
