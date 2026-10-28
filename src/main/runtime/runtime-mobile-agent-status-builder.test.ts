import { describe, expect, it } from 'vitest'
import type { AgentStatusIpcPayload } from '../../shared/agent-status-types'
import type { RuntimeMobileSessionTerminalTab } from '../../shared/runtime-types'
import type { RuntimeAgentRowSnapshot } from './runtime-hook-agent-row-selection'
import { buildRuntimeMobileAgentStatus } from './runtime-mobile-agent-status-builder'

const PROVIDER_SESSION = { key: 'session_id' as const, id: 'session-1' }
const TAB: RuntimeMobileSessionTerminalTab = {
  type: 'terminal',
  id: 'tab::leaf',
  parentTabId: 'tab',
  leafId: 'leaf',
  title: 'Terminal',
  isActive: true
}

describe('mobile agent status builder', () => {
  it('keeps provider-session identity from a terminal-handle row rejoin', () => {
    const retained: RuntimeAgentRowSnapshot = {
      paneKey: 'old-tab:old-leaf',
      connectionId: null,
      payload: { state: 'working', prompt: 'ship it', agentType: 'codex' },
      stateStartedAt: 10,
      updatedAt: 10,
      providerSession: PROVIDER_SESSION
    }

    const result = buildRuntimeMobileAgentStatus(null, TAB, 'term-1', retained, () => [], {
      getPaneKey: () => 'new-tab:new-leaf',
      getLeaf: () => null,
      getTrackedTitle: () => null
    })

    expect(result).toEqual(
      expect.objectContaining({
        agentStatus: expect.objectContaining({ providerSession: PROVIDER_SESSION })
      })
    )
  })

  // The phone's background-work pill reads these off the terminal tab; no other wire carries them.
  describe('background work for a terminal-backed chat', () => {
    const host = {
      getPaneKey: () => 'tab:leaf',
      getLeaf: () => null,
      getTrackedTitle: () => null
    }
    const subagents = [
      {
        id: 'a1',
        agentType: 'Explore',
        description: 'Map the repo',
        state: 'working',
        startedAt: 20
      },
      { id: 'a2', agentType: 'Plan', state: 'idle', startedAt: 30 }
    ] as const
    const mainAgent = { state: 'done', outcome: 'success', stateStartedAt: 40 } as const

    it('carries the retained row subagents, main agent and turn start to the tab status', () => {
      const retained: RuntimeAgentRowSnapshot = {
        paneKey: 'tab:leaf',
        connectionId: null,
        payload: {
          state: 'working',
          prompt: 'ship it',
          agentType: 'claude',
          subagents: [...subagents],
          mainAgent
        },
        stateStartedAt: 10,
        updatedAt: Date.now()
      }

      const result = buildRuntimeMobileAgentStatus(null, TAB, 'term-1', retained, () => [], host)

      expect(result).toEqual({
        agentStatus: expect.objectContaining({ subagents: [...subagents], mainAgent })
      })
    })

    it('carries the hook row subagents when the pane has no retained row', () => {
      const now = Date.now()
      const hookRow: AgentStatusIpcPayload = {
        paneKey: 'tab:leaf',
        connectionId: null,
        state: 'working',
        prompt: 'ship it',
        agentType: 'claude',
        subagents: [...subagents],
        mainAgent,
        receivedAt: now,
        stateStartedAt: 10
      }

      const result = buildRuntimeMobileAgentStatus(null, TAB, 'term-1', null, () => [hookRow], host)

      expect(result).toEqual({
        agentStatus: expect.objectContaining({ subagents: [...subagents], mainAgent })
      })
    })
  })
})
