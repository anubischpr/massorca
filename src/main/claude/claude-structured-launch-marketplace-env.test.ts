import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionJournalIdentity } from '../../shared/agent-session-journal-types'
import type { AgentSessionRecord } from '../../shared/agent-session-record'
import { agentSessionRecordFixture } from '../native-chat/agent-session-record-test-fixture'
import { createClaudeStructuredLaunchResolver } from './claude-structured-launch-resolution'

const marketplaceEnv = vi.hoisted((): { values: Record<string, string> } => ({ values: {} }))
vi.mock('../marketplace/marketplace-agent-env', () => ({
  buildMarketplaceAgentEnv: () => ({ ...marketplaceEnv.values })
}))

const RECORD: AgentSessionRecord = agentSessionRecordFixture({
  sessionId: 'orca-session-1',
  location: { workspaceId: 'workspace-1' },
  accountHome: { variable: 'CLAUDE_CONFIG_DIR', path: '/home/work/.claude' }
})

const IDENTITY: AgentSessionJournalIdentity = {
  sessionId: RECORD.sessionId,
  workspaceId: 'workspace-1',
  hostId: 'local',
  agent: 'claude',
  providerHandle: null
}

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

describe('claude structured launch marketplace env', () => {
  it('gives the session the connected apps credentials', async () => {
    marketplaceEnv.values = { OPENMETADATA_TOKEN: 'vault-token' }
    expect((await launch()).env?.OPENMETADATA_TOKEN).toBe('vault-token')
  })

  it('adds nothing when no app is connected', async () => {
    marketplaceEnv.values = {}
    expect((await launch()).env?.OPENMETADATA_TOKEN).toBeUndefined()
  })
})
