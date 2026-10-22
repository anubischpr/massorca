import { describe, expect, it, vi } from 'vitest'
import { dispatchStructuredAgentSessionComposerCommand } from './structured-agent-session-composer'

function controller(overrides: Record<string, unknown> = {}) {
  return {
    agent: 'codex' as const,
    functions: [],
    snapshot: [],
    invokeAction: async () => true,
    setOption: async () => true,
    providerCommands: ['rename', 'memories', 'review', 'fork'] as const,
    runProviderCommand: vi.fn(async () => ({ accepted: true, error: null })),
    ...overrides
  }
}

describe('provider command dispatch', () => {
  it('runs a command the host reported, with its argument', async () => {
    const options = controller()
    const outcome = await dispatchStructuredAgentSessionComposerCommand(
      '/rename Parser work',
      options
    )
    expect(outcome).toEqual({ handled: true, accepted: true, error: null })
    expect(options.runProviderCommand).toHaveBeenCalledWith('rename', 'Parser work')
  })

  it('asks for what a command needs before sending anything', async () => {
    const options = controller()
    expect(await dispatchStructuredAgentSessionComposerCommand('/rename', options)).toMatchObject({
      accepted: false,
      error: 'Give a name after /rename.'
    })
    expect(
      await dispatchStructuredAgentSessionComposerCommand('/memories maybe', options)
    ).toMatchObject({
      accepted: false,
      error: 'Use /memories on or /memories off.'
    })
    expect(await dispatchStructuredAgentSessionComposerCommand('/fork now', options)).toMatchObject(
      {
        accepted: false,
        error: 'Use /fork without arguments.'
      }
    )
    expect(options.runProviderCommand).not.toHaveBeenCalled()
  })

  it('sends optional text only when given', async () => {
    const options = controller()
    await dispatchStructuredAgentSessionComposerCommand('/review', options)
    await dispatchStructuredAgentSessionComposerCommand('/review the parser', options)
    await dispatchStructuredAgentSessionComposerCommand('/memories ON', options)
    expect(options.runProviderCommand.mock.calls).toEqual([
      ['review', undefined],
      ['review', 'the parser'],
      ['memories', 'on']
    ])
  })

  it('leaves a command the host did not report to the existing handlers', async () => {
    const outcome = await dispatchStructuredAgentSessionComposerCommand(
      '/usage',
      controller({ providerCommands: [] })
    )
    expect(outcome).toMatchObject({ handled: true, accepted: false })
    expect(outcome.error).toContain('/usage')
  })

  it('reveals background tasks for /ps, and says when there are none', async () => {
    const shown = controller({ revealBackgroundTasks: () => true })
    expect(await dispatchStructuredAgentSessionComposerCommand('/ps', shown)).toEqual({
      handled: true,
      accepted: true,
      error: null
    })
    const none = controller({ revealBackgroundTasks: () => false })
    expect(await dispatchStructuredAgentSessionComposerCommand('/ps', none)).toMatchObject({
      accepted: false,
      error: 'No background tasks are running.'
    })
  })
})
