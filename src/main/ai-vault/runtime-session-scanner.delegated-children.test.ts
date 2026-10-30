import { describe, expect, it, vi } from 'vitest'
import type { AiVaultSession } from '../../shared/ai-vault-types'
import { nestAiVaultDelegatedChildren } from '../../shared/ai-vault-delegated-nesting'

const mocks = vi.hoisted(() => ({ callRuntimeEnvironment: vi.fn() }))
vi.mock('../ipc/runtime-environment-transport-routing', () => ({
  callRuntimeEnvironment: mocks.callRuntimeEnvironment
}))

const { scanRuntimeAiVaultSessions } = await import('./runtime-session-scanner')

function row(sessionId: string, extra: Partial<AiVaultSession>): AiVaultSession {
  return {
    id: `x:${sessionId}`,
    executionHostId: 'runtime:env-1',
    agent: 'claude',
    sessionId,
    title: sessionId,
    cwd: '/srv/app',
    branch: null,
    model: null,
    filePath: `/s/${sessionId}.jsonl`,
    codexHome: null,
    createdAt: null,
    updatedAt: '2026-07-04T03:00:00.000Z',
    modifiedAt: '2026-07-04T00:00:00.000Z',
    messageCount: 1,
    totalTokens: 0,
    previewMessages: [],
    queuedMessageCount: 0,
    subagentTranscriptCount: 0,
    resumeCommand: '',
    subagent: null,
    ...extra
  }
}

describe('runtime scan keeps delegated children nestable', () => {
  it('nests a runtime child under its runtime parent', async () => {
    mocks.callRuntimeEnvironment.mockResolvedValue({
      ok: true,
      result: {
        sessions: [
          row('p', { structuredSession: { sessionId: 'S-P', workspaceId: 'w' } }),
          row('c', {
            structuredSession: { sessionId: 'S-C', workspaceId: 'w' },
            delegatedFrom: { parentSessionId: 'S-P', status: 'working' }
          })
        ],
        issues: [],
        scannedAt: '2026-07-04T03:00:00.000Z'
      }
    })
    const scanned = await scanRuntimeAiVaultSessions('/u', 'env-1', {})
    const nesting = nestAiVaultDelegatedChildren(scanned.sessions, scanned.sessions)
    expect(nesting.roots).toHaveLength(1)
  })
})
