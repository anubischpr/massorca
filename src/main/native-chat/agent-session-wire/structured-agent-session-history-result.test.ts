import { describe, expect, it } from 'vitest'
import type { AgentSessionProviderHandle } from '../../../shared/agent-session-provider-handle'
import { getAgentResumeArgv } from '../../../shared/agent-resume-argv'
import { agentSessionRecordFixture } from '../agent-session-record-test-fixture'
import { structuredAgentSessionProviderSessionMetadata } from './structured-agent-session-history-result'

function recordWith(handle: AgentSessionProviderHandle) {
  return agentSessionRecordFixture({
    sessionId: 's1',
    providerHandleChain: [
      { linkId: 'l1', handle, origin: 'created', mintedAtFence: 1, observedAt: 1 }
    ]
  })
}

describe('structuredAgentSessionProviderSessionMetadata', () => {
  it('has no session before a provider handle exists', () => {
    expect(structuredAgentSessionProviderSessionMetadata(null)).toBeUndefined()
    expect(
      structuredAgentSessionProviderSessionMetadata(agentSessionRecordFixture({ sessionId: 's1' }))
    ).toBeUndefined()
  })

  it('keeps Claude and Codex on session_id without a transcript path', () => {
    const claude = structuredAgentSessionProviderSessionMetadata(
      recordWith({ transport: 'claude-sdk', agent: 'claude', nativeId: 'c-1' })
    )
    const codex = structuredAgentSessionProviderSessionMetadata(
      recordWith({ transport: 'codex-app-server', agent: 'codex', nativeId: 't-1' })
    )
    expect(claude).toEqual({ key: 'session_id', id: 'c-1' })
    expect(codex).toEqual({ key: 'session_id', id: 't-1' })
    expect(getAgentResumeArgv('claude', claude!)).toEqual(['claude', '--resume', 'c-1'])
    expect(getAgentResumeArgv('codex', codex!)).toEqual(['codex', 'resume', 't-1'])
  })

  it('publishes Antigravity as a conversation id so `agy --conversation` resumes it', () => {
    const session = structuredAgentSessionProviderSessionMetadata(
      recordWith({ transport: 'antigravity-stream-json', agent: 'antigravity', nativeId: 'conv-1' })
    )
    expect(session).toEqual({ key: 'conversation_id', id: 'conv-1' })
    expect(getAgentResumeArgv('antigravity', session!)).toEqual(['agy', '--conversation', 'conv-1'])
  })

  it('publishes the Pi session file for both Pi and Gentle Shell resumes', () => {
    const file = '/home/u/.pi/agent/sessions/a.jsonl'
    const session = structuredAgentSessionProviderSessionMetadata(
      recordWith({ transport: 'jsonl-rpc', agent: 'pi', nativeId: file })
    )
    expect(session).toEqual({ key: 'session_id', id: file, transcriptPath: file })
    expect(getAgentResumeArgv('pi', session!)).toEqual(['pi', '--session', file])
    expect(getAgentResumeArgv('pi', session!, null, 'gentle-shell')).toEqual([
      'gentle-shell',
      '--',
      '--session',
      file
    ])
  })
})
