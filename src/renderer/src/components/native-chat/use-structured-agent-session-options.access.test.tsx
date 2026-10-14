// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useStructuredAgentSessionOptions } from './use-structured-agent-session-options'

const mocks = vi.hoisted(() => ({
  hold: vi.fn(() => Promise.resolve({ kind: 'accepted', options: { accessMode: 'default' } })),
  write: vi.fn()
}))
vi.mock('@/runtime/use-host-structured-agent', () => ({
  useHostStructuredAgent: (() => {
    const agent = { capabilities: { supportedAccessModes: ['default', 'full-access'] } }
    return () => agent
  })()
}))
vi.mock('@/runtime/structured-agent-session-client', () => ({
  callStructuredAgentSession: () => new Promise(() => {})
}))
vi.mock('./native-chat-session-option-settings-write', () => ({
  enqueueSessionOptionSettingsWrite: mocks.write
}))
vi.mock('@/lib/structured-agent-session-launch-options', () => ({
  holdStructuredAgentSessionLaunchOption: mocks.hold,
  getStructuredAgentSessionLaunchSelection: () => null
}))

describe('session access picker lifecycle', () => {
  it('selects without a model listing and disables both UI and calls while starting or running', async () => {
    const mutate = vi.fn()
    const { result, rerender } = renderHook(
      ({ running, starting }) =>
        useStructuredAgentSessionOptions({
          agent: 'codex',
          sessionId: 'access-only',
          target: { kind: 'local' },
          transportEnabled: false,
          isVisible: true,
          providerVisible: false,
          providerRunning: running,
          providerStarting: starting,
          fence: null,
          turnId: null,
          unloadedTurnRevisions: undefined,
          mutate,
          launch: { kind: 'new', heldOptions: {} }
        }),
      { initialProps: { running: false, starting: false } }
    )
    expect(
      result.current.optionSnapshot.find((option) => option.id === 'accessMode')?.settable
    ).toBe(true)
    await act(async () => {
      expect(await result.current.setStructuredOption('accessMode', 'default')).toBe(true)
    })
    expect(mocks.hold).toHaveBeenCalledWith('access-only', 'accessMode', 'default')
    for (const state of [
      { running: false, starting: true },
      { running: true, starting: false }
    ]) {
      rerender(state)
      expect(
        result.current.optionSnapshot.find((option) => option.id === 'accessMode')?.settable
      ).toBe(false)
      await act(async () => {
        expect(await result.current.setStructuredOption('accessMode', 'full-access')).toBe(false)
      })
    }
    expect(mocks.hold).toHaveBeenCalledTimes(1)
    expect(mutate).not.toHaveBeenCalled()
    expect(mocks.write).not.toHaveBeenCalled()
  })
})
