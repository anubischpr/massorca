import { describe, expect, it, vi } from 'vitest'
import type * as OrcaCliChildPath from '../cli/orca-cli-child-path'
import type { AgentSessionRecord } from '../../shared/agent-session-record'
import { agentSessionRecordFixture } from '../../shared/agent-session-record.test-fixture'
import { DELEGATION_AGENT_INSTRUCTIONS_ONE_LINE } from '../delegated-session/delegation-agent-instructions'
import { withOpenCodeInstructionsFile } from './acp-delegation-instructions'
import { acpLaunchSpecFor } from './acp-launch-specs'
import { createAcpStructuredLaunchResolver } from './acp-structured-launch-resolution'

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

const FOLDER = '/state/delegation-instructions'
const identity = {
  sessionId: 'session-alpha-1',
  workspaceId: 'workspace-1',
  hostId: 'local',
  providerHandle: null
}

function resolve(
  agent: 'grok' | 'opencode' | 'omp',
  options: { folder?: string | null; inline?: string } = {}
) {
  const spec = acpLaunchSpecFor(agent)!
  const accountHome: AgentSessionRecord['accountHome'] =
    agent === 'opencode'
      ? { kind: 'opencode', locator: { kind: 'unmanaged' } }
      : agent === 'omp'
        ? { variable: 'PI_CODING_AGENT_DIR', path: '/home/user/.omp/agent' }
        : { variable: 'GROK_HOME', path: '/home/user/.grok' }
  const launchEnv: Record<string, string> = options.inline
    ? { OPENCODE_CONFIG_CONTENT: options.inline }
    : {}
  const record = {
    ...agentSessionRecordFixture(),
    provider: agent,
    providerHandleChain: [],
    accountHome
  }
  return createAcpStructuredLaunchResolver(spec, {
    store: { getRecord: () => record },
    readJournal: () => null,
    resolveWorkspacePath: async () => '/repo/worktree',
    resolveEnvironment: async () => ({ PATH: '/usr/bin', HOME: '/home/user' }),
    resolveLaunchEnv: () => launchEnv,
    resolveCommand: (command) => `/resolved/${command}`,
    inheritedEnv: {},
    probeVersion: async (_input, supports) => supports(agent === 'omp' ? '18.4.5' : '1.18.31'),
    resolveDelegationInstructionsFolder: async () =>
      options.folder === undefined ? FOLDER : options.folder
  })({ identity: { ...identity, agent } })
}

describe('withOpenCodeInstructionsFile', () => {
  it('adds the file to an empty config and after the user instructions', () => {
    expect(JSON.parse(withOpenCodeInstructionsFile(undefined, '/i/AGENTS.md')!)).toEqual({
      instructions: ['/i/AGENTS.md']
    })
    expect(
      JSON.parse(
        withOpenCodeInstructionsFile('{"theme":"x","instructions":["mine.md"]}', '/i/A.md')!
      )
    ).toEqual({ theme: 'x', instructions: ['mine.md', '/i/A.md'] })
  })

  it('leaves a config it cannot extend safely alone', () => {
    for (const content of ['{ // jsonc', '[]', '{"instructions":"mine.md"}']) {
      expect(withOpenCodeInstructionsFile(content, '/i/A.md')).toBeNull()
    }
  })
})

describe('ACP launch delegation instructions', () => {
  it('points OpenCode at the instructions file beside the config the user set inline', async () => {
    launcher.resolved = true
    const launch = await resolve('opencode', { inline: '{"instructions":["mine.md"]}' })
    const config = JSON.parse(launch.env.OPENCODE_CONFIG_CONTENT ?? '{}')
    expect(config.instructions[0]).toBe('mine.md')
    expect(config.instructions[1]).toContain('delegation-instructions')
    expect(config.instructions[1]).toMatch(/AGENTS\.md$/)
    expect(launch.args).toEqual(['acp'])
  })

  it('appends the instructions to the OMP system prompt', async () => {
    launcher.resolved = true
    const launch = await resolve('omp')
    expect(launch.args).toEqual([
      'acp',
      '--append-system-prompt',
      DELEGATION_AGENT_INSTRUCTIONS_ONE_LINE
    ])
  })

  it('leaves Grok, which has no verified channel, untouched', async () => {
    launcher.resolved = true
    const launch = await resolve('grok')
    expect(launch.args).toEqual(['agent', 'stdio'])
  })

  it('adds nothing when the instructions folder cannot be written or the Orca CLI is not reachable', async () => {
    launcher.resolved = true
    const noFolder = await resolve('opencode', { folder: null })
    expect(noFolder.env.OPENCODE_CONFIG_CONTENT).toBeUndefined()

    launcher.resolved = false
    const noCli = await resolve('omp')
    expect(noCli.args).toEqual(['acp'])
    expect((await resolve('opencode')).env.OPENCODE_CONFIG_CONTENT).toBeUndefined()
  })
})
