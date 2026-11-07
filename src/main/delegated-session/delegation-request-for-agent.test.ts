import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StructuredAgentSessionCreateSupport } from '../native-chat/structured-agent-session-create-support'
import { createEmptyRateLimitState } from '../../shared/rate-limit-state-factory'
import { OrchestrationDb } from '../runtime/orchestration/db'
import { delegationAgentDeps, type AgentCheckRuntime } from './delegation-agent-listing'
import { DelegationRequestService } from './delegation-request-service'
import type { DelegationParentSession, DelegationRequestDeps } from './delegation-service-types'

const NOW = 1_800_000_000_000
const PARENT: DelegationParentSession = {
  sessionId: 'session_parent_01',
  agent: 'claude',
  workspaceId: 'repo1::/work/app',
  workspaceKind: 'git',
  accessMode: 'accept-edits'
}
const TASK = {
  parentSessionId: PARENT.sessionId,
  summary: 'Read only audit of the parser module',
  title: 'Parser audit',
  prompt: 'Read src/parser and list every unsafe cast with file and line.',
  writes: false
}

/** A host where stock Pi is refused without full access and Gentle Shell gets `gentleShell`; other agents run. */
function hostWithGentleShell(gentleShell: StructuredAgentSessionCreateSupport): AgentCheckRuntime {
  return {
    getStructuredAgentSessionCreateSupport: async (_selector, agent, piRuntime) => {
      if (agent !== 'pi') {
        return { supported: true }
      }
      return piRuntime === 'gentle-shell' ? gentleShell : { supported: false, reason: 'access' }
    }
  }
}

describe('DelegationRequestService agent refusals', () => {
  let db: OrchestrationDb

  beforeEach(() => {
    db = new OrchestrationDb(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  function serviceOn(runtime: AgentCheckRuntime): DelegationRequestService {
    const deps: DelegationRequestDeps = {
      getDb: () => db,
      requireDb: () => db,
      rows: {
        appendHostRow: async () => {
          throw new Error('an agent-decided request posts no card')
        }
      },
      readParent: (sessionId) => (sessionId === PARENT.sessionId ? PARENT : null),
      ...delegationAgentDeps(runtime),
      readPrototypeCount: () => undefined,
      readDesignSystemCard: async () => null,
      readParentUserMessage: async () => undefined,
      readRateLimits: () => createEmptyRateLimitState({}),
      refreshUsage: async () => {},
      now: () => NOW
    }
    return new DelegationRequestService(deps)
  }

  function requestAgent(runtime: AgentCheckRuntime, piRuntime?: 'gentle-shell') {
    return serviceOn(runtime).requestForAgent({
      ...TASK,
      agent: 'pi',
      ...(piRuntime ? { piRuntime } : {})
    })
  }

  it('files a request for a bot whose stored Gentle Shell runs, where stock Pi is refused', async () => {
    const requestId = await requestAgent(hostWithGentleShell({ supported: true }), 'gentle-shell')

    const row = db.getDelegationRequest(requestId)
    expect(row?.status).toBe('pending')
    expect(JSON.parse(row?.decision_json ?? 'null')).toEqual({ piRuntime: 'gentle-shell' })
    expect(JSON.parse(row?.options_json ?? 'null')).toMatchObject({
      agents: expect.arrayContaining([
        { agent: 'pi', label: 'Gentle Shell', piRuntime: 'gentle-shell' }
      ])
    })
  })

  it('names the reason the Gentle Shell check gave when the bot runtime cannot run', async () => {
    const runtime = hostWithGentleShell({ supported: false, reason: 'agent', cause: 'cliMissing' })

    await expect(requestAgent(runtime, 'gentle-shell')).rejects.toMatchObject({
      code: 'delegation_no_agent',
      data: { effectsApplied: false }
    })
    await expect(requestAgent(runtime, 'gentle-shell')).rejects.toThrow(
      'No effects were applied. Reason: Gentle Shell (agent: cliMissing).'
    )
  })

  it('keeps the no-agent message and names the reason stock Pi was refused', async () => {
    await expect(requestAgent(hostWithGentleShell({ supported: true }))).rejects.toThrow(
      /^pi cannot run a chat in this workspace, so no child session can start\. No effects were applied\. Reason: Pi \(access\)\.$/
    )
  })

  it('still refuses an ordinary delegation of stock Pi that the host cannot run, and files nothing', async () => {
    await expect(requestAgent(hostWithGentleShell({ supported: true }))).rejects.toMatchObject({
      code: 'delegation_no_agent',
      data: { effectsApplied: false }
    })
    expect(db.listDelegationRequestsByStatus('pending')).toEqual([])
  })

  it('names every refusal when no agent can start a card in the workspace', async () => {
    const everythingRemote: AgentCheckRuntime = {
      getStructuredAgentSessionCreateSupport: async () => ({ supported: false, reason: 'remote' })
    }

    await expect(serviceOn(everythingRemote).request(TASK)).rejects.toThrow(
      /^No agent that can run a chat is usable in this workspace, so no child session can start\. No effects were applied\. Reason: .*Claude \(remote\)/
    )
  })
})
