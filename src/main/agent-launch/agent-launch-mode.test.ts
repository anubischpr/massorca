import { describe, expect, it } from 'vitest'
import {
  decideAgentLaunchMode,
  downgradeAgentLaunchModeForHost,
  type AgentLaunchModeSettings
} from './agent-launch-mode'

const terminalDefault: AgentLaunchModeSettings = { experimentalNativeChat: false }
const chatDefault: AgentLaunchModeSettings = { experimentalNativeChat: true }
const claude = { agent: 'claude' }

describe('decideAgentLaunchMode with a terminal default', () => {
  it('stays a terminal when nobody asks for a chat', () => {
    expect(decideAgentLaunchMode({ placement: claude, settings: terminalDefault })).toMatchObject({
      mode: 'terminal',
      preferred: 'terminal',
      reason: 'user_default'
    })
  })

  it('becomes a chat when the caller asks for one', () => {
    const receipt = decideAgentLaunchMode({
      placement: claude,
      settings: terminalDefault,
      preferredMode: 'chat'
    })
    expect(receipt).toMatchObject({
      mode: 'structured',
      preferred: 'terminal',
      reason: 'caller_requested_chat'
    })
    expect(receipt.detail).toMatch(/as this launch asked/)
  })

  it.each([
    ['a remote execution host', { agent: 'claude', on: 'server-1' }, 'remote_execution_host'],
    ['a reused terminal', { agent: 'claude', terminal: 'term-1' }, 'reused_terminal'],
    ['an agent with no chat', { agent: 'not-a-real-agent' }, 'agent_without_structured_session'],
    [
      'a start directory outside the workspace',
      { agent: 'claude', workspacePath: '/work/web', cwd: '/elsewhere' },
      'tui_launch_command'
    ]
  ])('still ends in a terminal for %s', (_name, placement, reason) => {
    const receipt = decideAgentLaunchMode({
      placement,
      settings: terminalDefault,
      preferredMode: 'chat'
    })
    expect(receipt).toMatchObject({ mode: 'terminal', preferred: 'terminal', reason })
    expect(receipt.detail).toMatch(/This launch asked for a structured chat session, but/)
  })

  it('still ends in a terminal when the caller cannot show a chat', () => {
    const receipt = decideAgentLaunchMode({
      placement: { agent: 'claude', callerRendersStructured: false },
      settings: terminalDefault,
      preferredMode: 'chat'
    })
    expect(receipt.mode).toBe('terminal')
  })

  it('never turns a terminal-only launch into a chat', () => {
    expect(
      decideAgentLaunchMode({
        placement: claude,
        settings: terminalDefault,
        terminalOnly: true,
        preferredMode: 'chat'
      }).mode
    ).toBe('terminal')
  })
})

describe('decideAgentLaunchMode with a chat default', () => {
  it('keeps reporting the user default, with or without the request', () => {
    for (const preferredMode of [undefined, 'chat' as const]) {
      expect(
        decideAgentLaunchMode({
          placement: claude,
          settings: chatDefault,
          ...(preferredMode ? { preferredMode } : {})
        })
      ).toMatchObject({ mode: 'structured', preferred: 'structured', reason: 'user_default' })
    }
  })

  it('words a downgrade as the default, not as a request', () => {
    const receipt = decideAgentLaunchMode({
      placement: { agent: 'claude', on: 'server-1' },
      settings: chatDefault,
      preferredMode: 'chat'
    })
    expect(receipt.detail).toMatch(/^Your default is a structured chat session/)
  })
})

describe('the host answer after the workspace is resolved', () => {
  const requested = decideAgentLaunchMode({
    placement: claude,
    settings: terminalDefault,
    preferredMode: 'chat'
  })

  it('keeps a requested chat the host can create', () => {
    expect(downgradeAgentLaunchModeForHost(requested, { supported: true })).toBe(requested)
  })

  it('names a reason when the host refuses on access alone', () => {
    const receipt = downgradeAgentLaunchModeForHost(requested, {
      supported: false,
      reason: 'access'
    })
    expect(receipt.reason).toBe('structured_unsupported_on_host')
    expect(receipt.detail).not.toMatch(/undefined/)
  })

  it('downgrades a requested chat the host cannot create, and says it was requested', () => {
    const receipt = downgradeAgentLaunchModeForHost(requested, { supported: false, reason: 'wsl' })
    expect(receipt).toMatchObject({
      mode: 'terminal',
      preferred: 'terminal',
      reason: 'wsl_execution_runtime'
    })
    expect(receipt.detail).toMatch(/^This launch asked for/)
  })
})
