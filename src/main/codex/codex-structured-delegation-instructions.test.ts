import { describe, expect, it, vi } from 'vitest'
import type * as OrcaCliChildPath from '../cli/orca-cli-child-path'
import { agentSessionRecordFixture } from '../native-chat/agent-session-record-test-fixture'
import { DELEGATION_AGENT_INSTRUCTIONS } from '../delegated-session/delegation-agent-instructions'
import { createCodexStructuredLaunchResolver } from './codex-structured-launch-resolution'
import { CodexAppServerRequestError } from './codex-app-server-request-error'
import { openCodexThread } from './codex-structured-thread-open'

const launcher = vi.hoisted(() => ({ resolved: true }))

vi.mock('../cli/orca-cli-child-path', async (importOriginal) => {
  const original = await importOriginal<typeof OrcaCliChildPath>()
  return {
    ...original,
    prependOrcaCliDirToChildPath: (
      ...args: Parameters<typeof original.prependOrcaCliDirToChildPath>
    ) => (launcher.resolved ? original.prependOrcaCliDirToChildPath(...args) : null)
  }
})

const RECORD = agentSessionRecordFixture({
  sessionId: 'session-1',
  provider: 'codex',
  location: { workspaceId: 'workspace-1' },
  accountHome: { variable: 'CODEX_HOME', path: '/home/work/.codex' }
})

function resolveLaunch() {
  return createCodexStructuredLaunchResolver({
    store: { getRecord: () => RECORD, pinLaunchDirectory: vi.fn() },
    resolveWorkspacePath: async (id) => `/repos/${id}`,
    resolveCommand: () => '/usr/local/bin/codex',
    resolveLaunchArgs: () => []
  })({
    identity: { sessionId: RECORD.sessionId } as Parameters<
      ReturnType<typeof createCodexStructuredLaunchResolver>
    >[0]['identity']
  })
}

describe('Codex child-session delegation instructions', () => {
  it('puts them on the launch when the Orca CLI is reachable, and omits them otherwise', async () => {
    launcher.resolved = true
    await expect(resolveLaunch()).resolves.toMatchObject({
      developerInstructions: DELEGATION_AGENT_INSTRUCTIONS
    })
    launcher.resolved = false
    await expect(resolveLaunch()).resolves.not.toHaveProperty('developerInstructions')
  })

  it('sends them as developer instructions on thread start and resume, apart from AGENTS.md', async () => {
    const request = vi.fn(async (_method: string, _params?: Record<string, unknown>) => ({
      thread: { id: 'thread-1' }
    }))
    const base = { cwd: '/work', developerInstructions: DELEGATION_AGENT_INSTRUCTIONS }
    await openCodexThread({ request }, { ...base, resumeThreadId: null }, 1_000)
    await openCodexThread({ request }, { ...base, resumeThreadId: 'thread-1' }, 1_000)
    await openCodexThread({ request }, { cwd: '/work', resumeThreadId: null }, 1_000)

    const params = request.mock.calls.map((call) => call[1])
    expect(request.mock.calls.map((call) => call[0]).slice(0, 2)).toEqual([
      'thread/start',
      'thread/resume'
    ])
    expect(params[0]).toMatchObject({ developerInstructions: DELEGATION_AGENT_INSTRUCTIONS })
    expect(params[1]).toMatchObject({ developerInstructions: DELEGATION_AGENT_INSTRUCTIONS })
    expect(params[2]).not.toHaveProperty('developerInstructions')
  })

  it.each([-32602, -32600])(
    'opens the thread without them when this Codex refuses the field (code %i), and stops asking',
    async (code) => {
      const request = vi.fn(async (method: string, params?: Record<string, unknown>) => {
        if (params && 'developerInstructions' in params) {
          throw new CodexAppServerRequestError(
            method,
            code,
            `Invalid request: unknown field \`developerInstructions\`, expected one of \`cwd\``
          )
        }
        return { thread: { id: 'thread-1' } }
      })
      const connection = { request }
      const launch = { cwd: '/work', developerInstructions: DELEGATION_AGENT_INSTRUCTIONS }

      await expect(
        openCodexThread(connection, { ...launch, resumeThreadId: null }, 1_000)
      ).resolves.toMatchObject({ threadId: 'thread-1' })
      await expect(
        openCodexThread(connection, { ...launch, resumeThreadId: 'thread-1' }, 1_000)
      ).resolves.toMatchObject({ threadId: 'thread-1' })

      // One refused attempt, then the bare retry; the resume never carries the field again.
      expect(request.mock.calls.map((call) => call[0])).toEqual([
        'thread/start',
        'thread/start',
        'thread/resume'
      ])
      expect(request.mock.calls[2]?.[1]).not.toHaveProperty('developerInstructions')
    }
  )

  it('still surfaces an unrelated refusal of the open', async () => {
    const request = vi.fn(async (method: string) => {
      throw new CodexAppServerRequestError(method, -32603, 'internal error')
    })
    await expect(
      openCodexThread(
        { request },
        { cwd: '/work', resumeThreadId: null, developerInstructions: 'x' },
        1_000
      )
    ).rejects.toThrow('internal error')
    expect(request).toHaveBeenCalledTimes(1)
  })
})
