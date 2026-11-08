import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  callMock,
  runtimeClientConstructorMock,
  serveOrcaAppMock,
  getDefaultUserDataPathMock,
  addEnvironmentFromPairingCodeMock,
  listEnvironmentsMock,
  spawnMock
} = vi.hoisted(() => ({
  callMock: vi.fn(),
  runtimeClientConstructorMock: vi.fn(),
  serveOrcaAppMock: vi.fn(),
  getDefaultUserDataPathMock: vi.fn(() => '/tmp/orca-user-data'),
  addEnvironmentFromPairingCodeMock: vi.fn(),
  listEnvironmentsMock: vi.fn(),
  spawnMock: vi.fn()
}))

vi.mock('./runtime-client', async () => {
  const { createRuntimeClientModuleMock } = await import('./index-test-harness.js')
  return createRuntimeClientModuleMock({
    callMock,
    runtimeClientConstructorMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock
  })
})

vi.mock('./runtime/environments', () => ({
  addEnvironmentFromPairingCode: addEnvironmentFromPairingCodeMock,
  listEnvironments: listEnvironmentsMock,
  removeEnvironment: vi.fn(),
  resolveEnvironment: vi.fn()
}))

vi.mock('child_process', async () => {
  const { createChildProcessModuleMock } = await import('./index-test-harness.js')
  return createChildProcessModuleMock(spawnMock)
})

import { main } from './index'
import { okFixture, queueFixtures } from './test-fixtures'
import { useWorktreeAwarenessEnvironment } from './index-test-harness'

const FOLDER = '/work/oppm/design/system'
const VALID_TOKENS = JSON.stringify({
  color: { primary: { $value: '#2563eb' } },
  $extensions: { massorca: { version: 3 } }
})

describe('orca prototypes design-system check', () => {
  let priorExitCode: typeof process.exitCode
  let logSpy: ReturnType<typeof vi.spyOn>

  useWorktreeAwarenessEnvironment({
    callMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock,
    addEnvironmentFromPairingCodeMock,
    listEnvironmentsMock,
    spawnMock
  })

  beforeEach(() => {
    priorExitCode = process.exitCode
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    process.exitCode = priorExitCode
  })

  function printed(): string {
    return logSpy.mock.calls.map((call) => String(call[0])).join('\n')
  }

  it('prints a readable verdict with the folder, version and files read', async () => {
    queueFixtures(
      callMock,
      okFixture('req_read', {
        ok: true,
        projectKey: 'oppm',
        projectName: 'oppm',
        fileNames: ['design/system/tokens.json', 'design/system/components.html'],
        tokensJson: VALID_TOKENS,
        componentsHtml: '<main></main>',
        folderPath: FOLDER
      })
    )

    await main(['prototypes', 'design-system', 'check', '--session', 'chat-1'])

    expect(callMock).toHaveBeenCalledWith('prototypes.readDesignSystem', { sessionId: 'chat-1' })
    expect(printed()).toBe(
      [
        'readable',
        `folder: ${FOLDER}`,
        'version: 3',
        'files read: design/system/tokens.json, design/system/components.html',
        '- design/system/system.md is missing (warning, not blocking).'
      ].join('\n')
    )
    expect(process.exitCode).not.toBe(1)
  })

  it('prints the reasons for an oppm-style system and exits 1', async () => {
    queueFixtures(
      callMock,
      okFixture('req_read', {
        ok: true,
        projectKey: 'oppm',
        projectName: 'oppm',
        fileNames: [],
        folderPath: FOLDER,
        otherFileNames: [
          'design/system/tokens.css',
          'design/system/README.md',
          'design/system/preview.html'
        ]
      })
    )

    await main(['prototypes', 'design-system', 'check', '--session', 'chat-1'])

    expect(process.exitCode).toBe(1)
    expect(printed()).toBe(
      [
        'not readable',
        `folder: ${FOLDER}`,
        'files read: none',
        '- design/system/tokens.json is missing; MassOrca reads the design system from it.',
        '- design/system/components.html is missing (warning, not blocking).',
        '- design/system/system.md is missing (warning, not blocking).',
        '- design/system holds tokens.css, README.md, preview.html, which MassOrca does not read; it reads tokens.json, components.html and system.md'
      ].join('\n')
    )
  })

  it('prints the verdict as stable JSON with --json', async () => {
    queueFixtures(
      callMock,
      okFixture('req_read', {
        ok: true,
        projectKey: 'oppm',
        projectName: 'oppm',
        fileNames: ['design/system/tokens.json'],
        tokensJson: VALID_TOKENS,
        folderPath: FOLDER
      })
    )

    await main(['prototypes', 'design-system', 'check', '--session', 'chat-1', '--json'])

    expect(JSON.parse(printed())).toEqual({
      readable: true,
      folderPath: FOLDER,
      version: 3,
      filesRead: ['design/system/tokens.json'],
      missing: ['design/system/components.html', 'design/system/system.md'],
      unreadable: [],
      otherFiles: [],
      reasons: [
        'design/system/components.html is missing (warning, not blocking).',
        'design/system/system.md is missing (warning, not blocking).'
      ]
    })
  })

  it('reports a chat not found on this host as not readable and exits 1', async () => {
    queueFixtures(callMock, okFixture('req_read', { ok: false, error: 'not_found' }))

    await main(['prototypes', 'design-system', 'check', '--session', 'chat-404'])

    expect(process.exitCode).toBe(1)
    expect(printed()).toBe(
      [
        'not readable',
        'files read: none',
        '- The chat was not found on this host, or it is not a local chat.'
      ].join('\n')
    )
  })

  it('checks a project folder, resolved from the working directory, with no chat named', async () => {
    queueFixtures(
      callMock,
      okFixture('req_project', {
        ok: true,
        projectKey: 'oppm',
        projectName: 'oppm',
        fileNames: ['design/system/tokens.json'],
        tokensJson: VALID_TOKENS,
        folderPath: FOLDER
      })
    )

    await main(['prototypes', 'design-system', 'check', '--project', 'oppm'])

    expect(callMock).toHaveBeenCalledWith('prototypes.readDesignSystem', {
      projectPath: resolve(process.cwd(), 'oppm')
    })
    expect(printed().split('\n')[0]).toBe('readable')
    expect(process.exitCode).not.toBe(1)
  })

  it('says a project folder was not found, and exits 1', async () => {
    queueFixtures(callMock, okFixture('req_project', { ok: false, error: 'not_found' }))

    await main(['prototypes', 'design-system', 'check', '--project', '/work/none'])

    expect(printed()).toBe(
      [
        'not readable',
        'files read: none',
        '- The project folder was not found on this host, or this caller may not read it.'
      ].join('\n')
    )
    expect(process.exitCode).toBe(1)
  })
})

describe('orca prototypes list', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  useWorktreeAwarenessEnvironment({
    callMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock,
    addEnvironmentFromPairingCodeMock,
    listEnvironmentsMock,
    spawnMock
  })

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('names a listed design system even when there are no prototype sets', async () => {
    queueFixtures(
      callMock,
      okFixture('req_list', {
        sets: [],
        designSystems: [
          {
            projectKey: 'oppm',
            projectName: 'oppm',
            status: 'detected',
            version: 1,
            tokenCount: 42,
            swatches: [],
            chat: { sessionId: 'chat-1', agent: 'claude' },
            folderPath: FOLDER
          }
        ]
      })
    )

    await main(['prototypes', 'list'])

    expect(logSpy.mock.calls.map((call) => String(call[0])).join('\n')).toBe(
      [
        'No prototype sets.',
        `Design system: oppm  v1  detected  42 tokens  chat chat-1  ${FOLDER}`
      ].join('\n')
    )
  })
})
