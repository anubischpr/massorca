import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAgentInfrastructureListener } from './agent-infrastructure-listener'
import { scanWorkspacePorts } from './local-workspace-port-scanner'
import { resetWorkspacePortScanTimeoutBackoffForTests } from './local-workspace-port-scan-state'
import {
  noteStructuredProviderProcess,
  releaseStructuredProviderProcess,
  structuredProviderProcessPids
} from './structured-provider-process-pids'

const runPortScanCommandMock = vi.hoisted(() => vi.fn())
vi.mock('./port-scan-command-client', () => ({
  runPortScanCommand: runPortScanCommandMock,
  isPortScanWorkerUnavailableError: () => false
}))

vi.mock('../runtime/agent-session-process-identity-probe', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  readProcessStartTimeMs: async () => 1000
}))

const none = new Set<number>()

describe('isAgentInfrastructureListener', () => {
  it.each([
    ['agy', '/usr/local/bin/agy chat'],
    ['claude', undefined],
    ['node', 'node /home/u/.nvm/lib/node_modules/@openai/codex/bin/codex.js'],
    [
      'node',
      '/usr/bin/node /opt/node_modules/@mariozechner/pi-coding-agent/dist/cli.js --mode rpc'
    ],
    ['node', String.raw`node C:\Users\u\gentle-pi\gentle-shell.js`],
    ['node', 'node /srv/npx/mcp-server-filesystem /repo'],
    ['node', 'node /x/node_modules/typescript/lib/tsserver.js'],
    ['engram', 'engram serve'],
    ['pi', undefined]
  ])('excludes %s %s', (processName, commandLine) => {
    expect(isAgentInfrastructureListener({ processName, commandLine }, none)).toBe(true)
  })

  it('excludes the provider child pid of a structured session', () => {
    expect(isAgentInfrastructureListener({ pid: 9, processName: 'node' }, new Set([9]))).toBe(true)
  })

  it.each([
    ['node', 'node /repo/node_modules/.bin/vite --port 5173'],
    ['python3', 'python3 -m http.server 8000'],
    ['node', 'node server.js --dir /home/u/claude-notes'],
    ['next-server', undefined]
  ])('keeps user server %s %s', (processName, commandLine) => {
    expect(isAgentInfrastructureListener({ processName, commandLine }, none)).toBe(false)
  })
})

describe('scanWorkspacePorts agent listeners', () => {
  afterEach(() => {
    resetWorkspacePortScanTimeoutBackoffForTests()
    vi.restoreAllMocks()
    runPortScanCommandMock.mockReset()
  })

  it('lists only the dev server, not agent or structured-child listeners in the workspace', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    noteStructuredProviderProcess({ pid: process.pid, processStartTimeMs: 1000 })
    runPortScanCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'lsof' && args.includes('-iTCP')) {
        return {
          stdout: [
            'p301',
            'cagy',
            'n127.0.0.1:41001',
            'p302',
            'cnode',
            'n127.0.0.1:5173',
            `p${process.pid}`,
            'cnode',
            'n127.0.0.1:41002'
          ].join('\n'),
          spawnMs: 5
        }
      }
      if (command === 'lsof') {
        return {
          stdout: ['p301', 'n/repo', 'p302', 'n/repo', `p${process.pid}`, 'n/repo'].join('\n'),
          spawnMs: 5
        }
      }
      return {
        stdout: ['301 /bin/agy', '302 node /repo/node_modules/.bin/vite'].join('\n'),
        spawnMs: 5
      }
    })
    const scan = await scanWorkspacePorts(
      [{ id: 'r::/repo', repoId: 'r', displayName: 'repo', path: '/repo' }],
      { lookup: () => undefined, reconcileScan: vi.fn() }
    )
    expect(scan.ports.map((port) => port.port)).toEqual([5173])
    expect(scan.ports[0]?.kind).toBe('workspace')
  })
})

describe('structured provider process registry', () => {
  it('releases a pid on request', async () => {
    noteStructuredProviderProcess({ pid: 501, processStartTimeMs: 10 })
    releaseStructuredProviderProcess(501)
    expect((await structuredProviderProcessPids(async () => 10)).has(501)).toBe(false)
  })

  it('drops an entry on any failed probe, not only a missing process', async () => {
    noteStructuredProviderProcess({ pid: 502, processStartTimeMs: 10 })
    const denied = Object.assign(new Error('denied'), { code: 'EPERM' })
    expect((await structuredProviderProcessPids(() => Promise.reject(denied))).has(502)).toBe(false)
    noteStructuredProviderProcess({ pid: 503, processStartTimeMs: 10 })
    expect((await structuredProviderProcessPids(async () => null)).has(503)).toBe(false)
  })

  it('stops trusting a pid the OS reused for a different process', async () => {
    noteStructuredProviderProcess({ pid: 504, processStartTimeMs: 10_000 })
    expect((await structuredProviderProcessPids(async () => 10_000)).has(504)).toBe(true)
    expect((await structuredProviderProcessPids(async () => 90_000)).has(504)).toBe(false)
    expect((await structuredProviderProcessPids(async () => 10_000)).has(504)).toBe(false)
  })
})
