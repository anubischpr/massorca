import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionRecord } from '../../shared/agent-session-record'
import type { AgentSessionJournalIdentity } from '../../shared/agent-session-journal-types'
import { agentSessionRecordFixture } from '../../shared/agent-session-record.test-fixture'
import { CLAUDE_PROMPT_SUGGESTIONS_FLAG, type ClaudeCliFlag } from './claude-cli-flag-support'
import {
  createClaudeStructuredLaunchResolver,
  type ClaudeStructuredLaunchResolverDeps
} from './claude-structured-launch-resolution'

const record: AgentSessionRecord = { ...agentSessionRecordFixture(), providerHandleChain: [] }
const IDENTITY: AgentSessionJournalIdentity = {
  sessionId: record.sessionId,
  workspaceId: 'workspace-1',
  hostId: 'local',
  agent: 'claude',
  providerHandle: null
}

function launch(
  resolvePromptSuggestions: (() => boolean) | undefined,
  supported: (flag: ClaudeCliFlag) => boolean
) {
  const supports = vi.fn(async (flag: ClaudeCliFlag) => supported(flag))
  const deps: ClaudeStructuredLaunchResolverDeps = {
    store: { getRecord: () => record, pinLaunchDirectory: vi.fn() },
    resolveWorkspacePath: async (id) => `/repos/${id}`,
    resolveLaunchArgs: () => [],
    resolveCommand: () => '/usr/local/bin/claude',
    resolveAuthPolicy: () => ({ stripAuthEnv: false }),
    hasTranscript: async () => false,
    cliFlags: { supports },
    ...(resolvePromptSuggestions ? { resolvePromptSuggestions } : {})
  }
  return createClaudeStructuredLaunchResolver(deps)({ identity: IDENTITY }).then((result) => ({
    result,
    supports
  }))
}

describe('Claude native prompt suggestions at launch', () => {
  it('asks the CLI to predict the next message when the setting is on and the CLI can', async () => {
    const { result } = await launch(
      () => true,
      (flag) => flag === CLAUDE_PROMPT_SUGGESTIONS_FLAG
    )
    expect(result.options.promptSuggestions).toBe(true)
  })

  it('leaves it off when the user turned suggestions off, and never probes for it', async () => {
    const off = await launch(
      () => false,
      () => true
    )
    expect(off.result.options).not.toHaveProperty('promptSuggestions')
    expect(off.supports.mock.calls.map(([flag]) => flag)).not.toContain(
      CLAUDE_PROMPT_SUGGESTIONS_FLAG
    )
    const absent = await launch(undefined, () => true)
    expect(absent.result.options).not.toHaveProperty('promptSuggestions')
  })

  it('leaves it off for a CLI that is not known to take it', async () => {
    const { result } = await launch(
      () => true,
      () => false
    )
    expect(result.options).not.toHaveProperty('promptSuggestions')
  })
})
