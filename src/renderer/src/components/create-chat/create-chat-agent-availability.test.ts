import { describe, expect, it, vi } from 'vitest'

vi.mock('../tab-bar/tab-agent-launch-options', () => ({
  // Keeps the detected order; catalog ordering is covered where it lives.
  orderTabLaunchAgents: (_default: unknown, agents: readonly string[]) => [...agents]
}))

import { createChatAgentsForHost } from './create-chat-agent-availability'

const base = {
  piAvailable: false,
  hostStructuredAgents: ['claude', 'codex', 'pi', 'antigravity', 'grok'],
  defaultAgent: null,
  disabled: []
}

describe('createChatAgentsForHost', () => {
  it('offers only installed agents the host can open as a chat', () => {
    expect(
      createChatAgentsForHost({
        ...base,
        detected: ['claude', 'aider', 'antigravity', 'goose', 'codex']
      })
    ).toEqual(['claude', 'antigravity', 'codex'])
  })

  it('never offers the retired Gemini CLI', () => {
    expect(
      createChatAgentsForHost({
        ...base,
        detected: ['gemini', 'claude'],
        hostStructuredAgents: [...base.hostStructuredAgents, 'gemini']
      })
    ).toEqual(['claude'])
  })

  it('offers Pi when the host runs it or Gentle Shell, though it is off PATH', () => {
    expect(createChatAgentsForHost({ ...base, detected: ['claude'], piAvailable: true })).toEqual([
      'claude',
      'pi'
    ])
  })

  it('offers only Claude and Codex until the host lists its structured agents', () => {
    expect(
      createChatAgentsForHost({
        ...base,
        detected: ['claude', 'grok', 'codex'],
        piAvailable: true,
        hostStructuredAgents: undefined
      })
    ).toEqual(['claude', 'codex'])
  })

  it('is empty while detection is in flight and no Pi is known', () => {
    expect(createChatAgentsForHost({ ...base, detected: null })).toEqual([])
  })
})
