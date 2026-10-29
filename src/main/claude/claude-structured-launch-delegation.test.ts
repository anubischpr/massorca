import { describe, expect, it, vi } from 'vitest'
import type * as OrcaCliChildPath from '../cli/orca-cli-child-path'
import type { AgentSessionRecord } from '../../shared/agent-session-record'
import { agentSessionRecordFixture } from '../native-chat/agent-session-record-test-fixture'
import { createClaudeStructuredLaunchResolver } from './claude-structured-launch-resolution'

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

const RECORD: AgentSessionRecord = agentSessionRecordFixture({
  sessionId: 'orca-session-1',
  location: { workspaceId: 'workspace-1' },
  accountHome: { variable: 'CLAUDE_CONFIG_DIR', path: '/home/work/.claude' }
})

const IDENTITY = { sessionId: RECORD.sessionId } as Parameters<
  ReturnType<typeof createClaudeStructuredLaunchResolver>
>[0]['identity']

function launch() {
  return createClaudeStructuredLaunchResolver({
    store: { getRecord: () => RECORD, pinLaunchDirectory: vi.fn() },
    resolveWorkspacePath: async (id) => `/repos/${id}`,
    resolveCommand: () => '/usr/local/bin/claude',
    resolveAuthPolicy: () => ({ stripAuthEnv: false }),
    resolveLaunchArgs: () => [],
    hasTranscript: async () => false
  })({ identity: IDENTITY })
}

describe('claude structured launch delegation instructions', () => {
  it('appends the child-session instructions to the preset when the Orca CLI is reachable', async () => {
    launcher.resolved = true
    const { options } = await launch()
    expect(options.systemPrompt).toMatchObject({ type: 'preset', preset: 'claude_code' })
    expect(JSON.stringify(options.systemPrompt)).toContain('orca orchestration delegate')
  })

  it('leaves the preset untouched when no Orca CLI launcher resolved for the child', async () => {
    launcher.resolved = false
    const { options } = await launch()
    expect(options.systemPrompt).toEqual({ type: 'preset', preset: 'claude_code' })
  })
})
