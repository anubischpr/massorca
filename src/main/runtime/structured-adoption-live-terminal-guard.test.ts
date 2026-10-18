import { describe, expect, it } from 'vitest'
import { paneKeyPtyId } from '../ipc/pty/pane/key-state'
import { isAgentSessionRefusalError } from '../../shared/agent-session-wire-refusals'
import {
  assertNoLiveTerminalHoldsProviderSession,
  findLiveTerminalHoldingProviderSession
} from './structured-adoption-live-terminal-guard'
import { resolveStructuredAgentSessionAdoptionForCreate } from './structured-agent-session-create-adoption'

const SESSION = 'provider-session-1'
const TERMINAL_PANE_KEY = 'tab-a:leaf-a'
const identities = [
  { paneKey: 'tab-a:leaf-a', sessionId: SESSION },
  { paneKey: 'tab-b:leaf-b', sessionId: 'another-session' }
]

describe('live terminal adoption guard', () => {
  it('finds the live pane that reports the provider session', () => {
    expect(
      findLiveTerminalHoldingProviderSession({
        identities,
        providerSessionId: SESSION,
        isPaneKeyPtyLive: (paneKey) => paneKey === 'tab-a:leaf-a'
      })
    ).toEqual(identities[0])
  })

  it('allows adoption once the pane PTY is gone', () => {
    expect(
      findLiveTerminalHoldingProviderSession({
        identities,
        providerSessionId: SESSION,
        isPaneKeyPtyLive: () => false
      })
    ).toBeNull()
  })

  it('ignores live panes that report a different session', () => {
    expect(
      findLiveTerminalHoldingProviderSession({
        identities,
        providerSessionId: 'unrelated-session',
        isPaneKeyPtyLive: () => true
      })
    ).toBeNull()
  })

  it('refuses with a conflict naming the live owner', () => {
    let refusal: unknown
    try {
      assertNoLiveTerminalHoldsProviderSession({
        identities,
        providerSessionId: SESSION,
        isPaneKeyPtyLive: () => true
      })
    } catch (error) {
      refusal = error
    }
    expect(isAgentSessionRefusalError(refusal)).toBe(true)
    expect(refusal).toMatchObject({
      refusal: { code: 'agent_session_conflict', details: { reason: 'ownerAlive' } }
    })
  })

  it('refuses adoption at create while a live terminal runs the session', async () => {
    paneKeyPtyId.set(TERMINAL_PANE_KEY, 'pty-held-by-tui')
    try {
      await expect(
        resolveStructuredAgentSessionAdoptionForCreate({
          host: null,
          settings: {},
          agent: 'claude',
          providerSessionId: SESSION,
          selfSessionId: 'structured-self',
          selectedAccountHomePath: '/unused',
          providerSessionRows: [
            { paneKey: TERMINAL_PANE_KEY, providerSession: { id: SESSION } },
            { paneKey: 'status-only-pane' }
          ]
        })
      ).rejects.toMatchObject({
        refusal: { code: 'agent_session_conflict', details: { reason: 'ownerAlive' } }
      })
    } finally {
      paneKeyPtyId.delete(TERMINAL_PANE_KEY)
    }
  })
})
