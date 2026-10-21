import { describe, expect, it, vi } from 'vitest'
import { dispatchStructuredAgentSessionComposerCommand } from './structured-agent-session-composer'
import { dispatchStructuredAgentSessionClientCommand } from './structured-agent-session-client-command-dispatch'

function controller(overrides: Record<string, unknown> = {}) {
  return {
    agent: 'codex' as const,
    functions: undefined,
    snapshot: [],
    invokeAction: async () => true,
    setOption: async () => true,
    providerCommands: [],
    ...overrides
  }
}

describe('the chat answers its own slash commands', () => {
  it('appends the status row for /status and refuses an argument', async () => {
    const status = vi.fn(() => true)
    const options = controller({ status })
    expect(await dispatchStructuredAgentSessionComposerCommand('/status', options)).toEqual({
      handled: true,
      accepted: true,
      error: null
    })
    expect(status).toHaveBeenCalledTimes(1)
    expect(await dispatchStructuredAgentSessionComposerCommand('/status now', options)).toEqual({
      handled: true,
      accepted: false,
      error: 'Use /status without arguments.'
    })
    expect(status).toHaveBeenCalledTimes(1)
  })

  it('reports why /status could not show when the chat refuses it', async () => {
    const options = controller({ status: () => false })
    expect(await dispatchStructuredAgentSessionComposerCommand('/status', options)).toEqual({
      handled: true,
      accepted: false,
      error: 'Could not show the chat status.'
    })
  })

  it('opens the Context section for /context', async () => {
    const context = vi.fn(() => true)
    expect(
      await dispatchStructuredAgentSessionComposerCommand('/context', controller({ context }))
    ).toEqual({ handled: true, accepted: true, error: null })
    expect(context).toHaveBeenCalledTimes(1)
  })

  it('opens the access picker for /permissions, and says so when the chat has none', async () => {
    const permissions = vi.fn(async () => true)
    expect(
      await dispatchStructuredAgentSessionComposerCommand(
        '/permissions',
        controller({ permissions })
      )
    ).toEqual({ handled: true, accepted: true, error: null })
    const refused = vi.fn(async () => false)
    expect(
      await dispatchStructuredAgentSessionComposerCommand(
        '/permissions',
        controller({ permissions: refused })
      )
    ).toEqual({
      handled: true,
      accepted: false,
      error: 'Access mode is unavailable for this chat session.'
    })
  })

  it('copies the newest answer for /copy, and says there is none when the chat has no reply', async () => {
    const copy = vi.fn(async () => true)
    expect(
      await dispatchStructuredAgentSessionComposerCommand('/copy', controller({ copy }))
    ).toEqual({ handled: true, accepted: true, error: null })
    expect(
      await dispatchStructuredAgentSessionComposerCommand(
        '/copy',
        controller({ copy: async () => false })
      )
    ).toEqual({ handled: true, accepted: false, error: 'There is no reply to copy yet.' })
  })

  it('exports the transcript for /export only where the chat offers it', async () => {
    const exportChat = vi.fn(async () => true)
    expect(
      await dispatchStructuredAgentSessionComposerCommand(
        '/export',
        controller({ export: exportChat })
      )
    ).toEqual({ handled: true, accepted: true, error: null })
    expect(exportChat).toHaveBeenCalledTimes(1)
    // Without the callback the command is not the chat's: agy sends it to the agent as text, as before.
    expect(
      await dispatchStructuredAgentSessionComposerCommand(
        '/export',
        controller({ agent: 'antigravity' })
      )
    ).toEqual({ handled: false, accepted: false, error: null })
  })

  it('inserts the mention with its query for /mention and /open', async () => {
    const mention = vi.fn(() => true)
    expect(
      await dispatchStructuredAgentSessionComposerCommand(
        '/mention src/app',
        controller({ mention })
      )
    ).toEqual({ handled: true, accepted: true, error: null })
    expect(mention).toHaveBeenCalledWith('src/app')
    const open = vi.fn(() => true)
    await dispatchStructuredAgentSessionComposerCommand('/open', controller({ open }))
    expect(open).toHaveBeenCalledWith('')
  })

  it('renames the tab to the argument, or starts the inline rename without one', async () => {
    const rename = vi.fn(() => true)
    expect(
      await dispatchStructuredAgentSessionComposerCommand(
        '/rename Release check',
        controller({ rename })
      )
    ).toEqual({ handled: true, accepted: true, error: null })
    expect(rename).toHaveBeenLastCalledWith('Release check')
    await dispatchStructuredAgentSessionComposerCommand('/rename', controller({ rename }))
    expect(rename).toHaveBeenLastCalledWith(null)
  })

  it('leaves a command it does not answer to the next handler', async () => {
    expect(
      await dispatchStructuredAgentSessionClientCommand(
        { name: 'copy', argument: '' },
        { rename: () => true }
      )
    ).toBeNull()
  })
})

describe('provider answers and text commands stay as they were', () => {
  it('runs /usage and /side on the provider when the host reports them', async () => {
    const runProviderCommand = vi.fn(async () => ({ accepted: true, error: null }))
    const options = controller({ providerCommands: ['usage', 'side'], runProviderCommand })
    expect(await dispatchStructuredAgentSessionComposerCommand('/usage', options)).toEqual({
      handled: true,
      accepted: true,
      error: null
    })
    expect(await dispatchStructuredAgentSessionComposerCommand('/side', options)).toEqual({
      handled: true,
      accepted: true,
      error: null
    })
    expect(runProviderCommand).toHaveBeenNthCalledWith(1, 'usage', undefined)
    expect(runProviderCommand).toHaveBeenNthCalledWith(2, 'side', undefined)
  })

  it('sends /plan to Codex as text, since no request sets its collaboration mode', async () => {
    expect(await dispatchStructuredAgentSessionComposerCommand('/plan', controller())).toEqual({
      handled: false,
      accepted: false,
      error: null
    })
  })
})
