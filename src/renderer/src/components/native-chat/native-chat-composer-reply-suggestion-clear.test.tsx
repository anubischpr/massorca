import { changePrompt } from './native-chat-prompt-editor.test-support'
// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as nativeChatAgentProfiles from '../../../../shared/native-chat-agent-profiles'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('./NativeChatComposerActions', () => ({
  NativeChatComposerActions: () => <div data-testid="composer-actions" />
}))
vi.mock('./NativeChatAutocompleteMenus', () => ({
  NativeChatMentionHint: () => null,
  NativeChatPickerMenu: () => null
}))
vi.mock('../../store', () => {
  const state = {
    dictationState: 'idle',
    settings: { voice: { enabled: false }, nativeChatSessionOptions: {} },
    agentStatusByPaneKey: {},
    updateSettings: vi.fn(),
    clearNativeChatLaunchDraft: vi.fn(),
    markNativeChatLaunchDraftAdopted: vi.fn()
  }
  const useAppStore = (selector: (value: typeof state) => unknown): unknown => selector(state)
  useAppStore.getState = () => state
  return { useAppStore }
})
vi.mock('@/runtime/runtime-terminal-inspection', () => ({
  isRemoteRuntimePtyId: () => false,
  sendRuntimePtyInput: vi.fn()
}))
vi.mock('@/lib/agent-paste-draft', () => ({
  getSettingsForAgentTabRuntimeOwner: () => ({})
}))
vi.mock('./native-chat-runtime-send', () => ({
  sendNativeChatMessage: vi.fn(),
  sendNativeChatTypedCommand: vi.fn(),
  sendNativeChatMessageVerified: vi.fn(),
  typeNativeChatCommand: vi.fn(),
  submitNativeChatPrompt: vi.fn()
}))
vi.mock('./native-chat-runtime-image-send', () => ({
  sendNativeChatMessageWithImageAttachments: vi.fn()
}))
vi.mock('./claude-model-switch-confirmation', () => ({
  createClaudeModelSwitchConfirmationObserver: vi.fn()
}))
vi.mock('../../../../shared/native-chat-agent-profiles', async (importOriginal) => ({
  ...(await importOriginal<typeof nativeChatAgentProfiles>()),
  getVerifiedNativeChatCommands: () => []
}))
vi.mock('@/lib/native-chat-telemetry', () => ({
  emitNativeChatMessageSent: vi.fn(),
  emitNativeChatPickerItemAccepted: vi.fn(),
  emitNativeChatPickerOpened: vi.fn(),
  emitNativeChatSendClassified: vi.fn()
}))
vi.mock('./use-native-chat-skills', () => ({
  useNativeChatSkills: () => ({ status: 'ready', skills: [], error: null, retry: () => {} })
}))
vi.mock('../dictation/dictation-control-events', () => ({
  dispatchDictationControl: vi.fn()
}))

import { NativeChatComposer } from './NativeChatComposer'

let paneCounter = 0

/** The real composer, editor and draft store over a chat whose host holds a suggestion. */
function renderComposer(offered: { text: string; dismiss: () => void } | null): HTMLElement {
  paneCounter += 1
  render(
    <NativeChatComposer
      terminalTabId={`tab-${paneCounter}`}
      paneKey={`tab-${paneCounter}:suggestion`}
      targetPtyId={null}
      agent="claude"
      structuredTransport={{
        send: vi.fn(() => true),
        dispatchCommand: vi.fn(async () => ({ handled: false, accepted: false, error: null })),
        optionsSurface: {
          getSnapshot: () => [],
          setOption: vi.fn(),
          invokeAction: vi.fn(),
          subscribe: () => () => {}
        },
        optionSnapshot: [],
        onError: vi.fn(),
        runtime: 'local',
        sessionId: `session-${paneCounter}`,
        runtimeEnvironmentId: null,
        replySuggestion: offered
      }}
    />
  )
  return screen.getByRole('textbox')
}

const shown = (input: HTMLElement): string | null =>
  input.querySelector('p.is-editor-empty')?.getAttribute('data-placeholder') ?? null

beforeEach(() => {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      git: { discoverCommitMessageModels: vi.fn().mockResolvedValue({ success: false }) },
      pty: { getMainBufferSnapshot: vi.fn().mockResolvedValue(null) }
    }
  })
})

afterEach(() => cleanup())

describe('composer reply suggestion over the real editor', () => {
  it('shows the same suggestion again once typed text is cleared', () => {
    const offered = { text: 'Run the tests', dismiss: vi.fn() }
    const input = renderComposer(offered)
    expect(shown(input)).toBe('Run the tests')
    changePrompt(input, 'my own message')
    expect(shown(input)).toBeNull()
    changePrompt(input, '')
    expect(shown(input)).toBe('Run the tests')
    expect(offered.dismiss).not.toHaveBeenCalled()
  })

  it.each(['/he', '  ', 'a b'])('shows it again after %j is typed and cleared', (typed) => {
    const input = renderComposer({ text: 'Run the tests', dismiss: vi.fn() })
    changePrompt(input, typed)
    changePrompt(input, '')
    expect(shown(input)).toBe('Run the tests')
  })
})
