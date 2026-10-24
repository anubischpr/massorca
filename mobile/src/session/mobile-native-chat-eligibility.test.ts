import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../../src/shared/agent-status-types'
import {
  canShowMobileNativeChat,
  isMobileFolderNativeChatReadable,
  isMobileNativeChatTranscriptReadable,
  resolveMobileNativeChat
} from './mobile-native-chat-eligibility'

function status(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'working',
    prompt: '',
    updatedAt: 0,
    stateStartedAt: 0,
    paneKey: 'tab:leaf',
    ...overrides
  } as AgentStatusEntry
}

describe('resolveMobileNativeChat', () => {
  it('prefers the authoritative supported live agent over a stale launch hint', () => {
    expect(
      resolveMobileNativeChat({
        type: 'terminal',
        launchAgent: 'claude',
        agentStatus: {
          agentType: 'codex',
          providerSession: { id: 'codex-session', transcriptPath: '/tmp/codex.jsonl' }
        }
      } as never)
    ).toMatchObject({ agent: 'codex', sessionId: 'codex-session' })
  })

  it('rejects an unsupported live agent instead of combining it with a stale hint', () => {
    expect(
      resolveMobileNativeChat({
        type: 'terminal',
        launchAgent: 'claude',
        agentStatus: {
          agentType: 'gemini',
          providerSession: { id: 'gemini-session', transcriptPath: '/tmp/gemini.jsonl' }
        }
      } as never)
    ).toBeNull()
  })
  it('resolves agent + sessionId from launchAgent and provider session', () => {
    expect(
      resolveMobileNativeChat({
        type: 'terminal',
        launchAgent: 'claude',
        agentStatus: status({
          providerSession: {
            key: 'session_id',
            id: 'sess-1',
            transcriptPath: '/tmp/claude-real-transcript.jsonl'
          }
        })
      })
    ).toEqual({
      agent: 'claude',
      sessionId: 'sess-1',
      transcriptPath: '/tmp/claude-real-transcript.jsonl'
    })
  })

  it('falls back to agentStatus.agentType when no launchAgent', () => {
    expect(
      resolveMobileNativeChat({
        type: 'terminal',
        agentStatus: status({ agentType: 'codex' })
      })
    ).toEqual({ agent: 'codex', sessionId: null, transcriptPath: null })
  })

  it('admits OpenClaude with its distinct agent identity', () => {
    expect(resolveMobileNativeChat({ type: 'terminal', launchAgent: 'openclaude' })).toEqual({
      agent: 'openclaude',
      sessionId: null,
      transcriptPath: null
    })
  })

  it.each(['opencode', 'opencode2'])('admits %s only on the execution host', (agent) => {
    const tab = {
      type: 'terminal',
      launchAgent: agent,
      agentStatus: status({
        providerSession: { key: 'session_id', id: 'real-session' }
      })
    }
    expect(resolveMobileNativeChat(tab, true)).toEqual({
      agent,
      sessionId: 'real-session',
      transcriptPath: null
    })
    expect(resolveMobileNativeChat(tab, false)).toBeNull()
  })

  it('returns null for unsupported agents', () => {
    expect(resolveMobileNativeChat({ type: 'terminal', launchAgent: 'gemini' })).toBeNull()
  })

  it('admits Grok only when its transcript is readable by the serving host', () => {
    const tab = { type: 'terminal', launchAgent: 'grok' }
    expect(resolveMobileNativeChat(tab, isMobileNativeChatTranscriptReadable(null))).toMatchObject({
      agent: 'grok'
    })
    expect(
      resolveMobileNativeChat(tab, isMobileNativeChatTranscriptReadable('runtime-ssh-environment'))
    ).toMatchObject({ agent: 'grok' })
    expect(
      resolveMobileNativeChat(tab, isMobileNativeChatTranscriptReadable('model-a-ssh'))
    ).toBeNull()
  })

  // Why: omp's hook reports no transcript path either, so mobile can only show
  // its chat when the serving host is the one holding the session file.
  it('admits omp only when its transcript is readable by the serving host', () => {
    const tab = { type: 'terminal', launchAgent: 'omp' }
    expect(resolveMobileNativeChat(tab, isMobileNativeChatTranscriptReadable(null))).toMatchObject({
      agent: 'omp'
    })
    expect(
      resolveMobileNativeChat(tab, isMobileNativeChatTranscriptReadable('runtime-ssh-environment'))
    ).toMatchObject({ agent: 'omp' })
    expect(
      resolveMobileNativeChat(tab, isMobileNativeChatTranscriptReadable('model-a-ssh'))
    ).toBeNull()
    expect(canShowMobileNativeChat(tab, isMobileNativeChatTranscriptReadable('model-a-ssh'))).toBe(
      false
    )
  })

  it('returns null for a plain shell (no agent)', () => {
    expect(resolveMobileNativeChat({ type: 'terminal' })).toBeNull()
  })

  it('returns null for non-terminal tabs', () => {
    expect(resolveMobileNativeChat({ type: 'browser', launchAgent: 'claude' })).toBeNull()
  })

  it('resolves Codex structured agent-session tabs directly', () => {
    expect(
      resolveMobileNativeChat({
        type: 'agent-session',
        sessionId: 'structured-1',
        agent: 'codex'
      })
    ).toEqual({
      agent: 'codex',
      sessionId: 'structured-1',
      transcriptPath: null
    })
  })

  it('resolves Claude structured agent-session tabs on the same journal path', () => {
    expect(
      resolveMobileNativeChat({
        type: 'agent-session',
        sessionId: 'structured-1',
        agent: 'claude'
      })
    ).toEqual({
      agent: 'claude',
      sessionId: 'structured-1',
      transcriptPath: null
    })
  })

  it('resolves structured agent-session tabs for any agent id the host sent', () => {
    for (const agent of ['antigravity', 'grok']) {
      expect(
        resolveMobileNativeChat({ type: 'agent-session', sessionId: 'structured-1', agent })
      ).toEqual({ agent, sessionId: 'structured-1', transcriptPath: null })
    }
  })

  it('names the Pi runtime of a structured Pi chat from the host marker', () => {
    const tab = { type: 'agent-session', sessionId: 'pi_1', agent: 'pi' }
    expect(resolveMobileNativeChat(tab)?.piRuntime).toBe('pi')
    expect(resolveMobileNativeChat({ ...tab, piRuntime: 'gentle-shell' })?.piRuntime).toBe(
      'gentle-shell'
    )
    // An unknown marker from a newer host keeps the stock identity rather than failing.
    expect(resolveMobileNativeChat({ ...tab, piRuntime: 'future-pi' })?.piRuntime).toBe('pi')
  })

  it('rejects structured agent-session tabs whose agent is not an agent id', () => {
    expect(
      resolveMobileNativeChat({
        type: 'agent-session',
        sessionId: 'structured-1',
        agent: 'not an agent'
      })
    ).toBeNull()
    expect(
      resolveMobileNativeChat({ type: 'agent-session', sessionId: 'structured-1', agent: null })
    ).toBeNull()
  })

  it('canShowMobileNativeChat mirrors resolution', () => {
    expect(canShowMobileNativeChat({ type: 'terminal', launchAgent: 'claude' })).toBe(true)
    expect(canShowMobileNativeChat(null)).toBe(false)
  })
})

it('resolves folder readability from the serving host catalog and rejects Model-A SSH', () => {
  const read = (connectionId: unknown) =>
    isMobileFolderNativeChatReadable(
      {
        folderWorkspaces: [{ id: 'one', connectionId }]
      },
      'folder:one'
    )
  expect(read(null)).toBe(true)
  expect(read('ssh:box')).toBe(false)
  expect(isMobileFolderNativeChatReadable({ folderWorkspaces: [] }, 'folder:one')).toBe(false)
  expect(isMobileFolderNativeChatReadable(null, 'folder:one')).toBe(false)
})
