// @vitest-environment happy-dom

// A session's unsent text survives the user leaving it (another session, + Create, Tasks) and
// coming back: the real composer is gone in between and a new one reads the draft store.

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRef } from 'react'
import type { NativeChatComposerHandle } from './native-chat-composer-types'

vi.mock('../../store', () => {
  const state = {
    tabsByWorktree: {},
    worktrees: [],
    repos: [],
    dictationState: 'idle',
    settings: { voice: { enabled: false }, nativeChatSessionOptions: {} },
    agentStatusByPaneKey: {},
    updateSettings: vi.fn(),
    clearNativeChatLaunchDraft: vi.fn(),
    markNativeChatLaunchDraftAdopted: vi.fn()
  }
  const useAppStore = (selector: (value: typeof state) => unknown) => selector(state)
  useAppStore.getState = () => state
  return { useAppStore }
})
vi.mock('@/runtime/runtime-terminal-inspection', () => ({
  isRemoteRuntimePtyId: () => false,
  sendRuntimePtyInput: vi.fn()
}))
vi.mock('@/lib/agent-paste-draft', () => ({ getSettingsForAgentTabRuntimeOwner: () => ({}) }))
vi.mock('@/lib/native-chat-telemetry', () => ({
  emitNativeChatMessageSent: vi.fn(),
  emitNativeChatPickerItemAccepted: vi.fn(),
  emitNativeChatPickerOpened: vi.fn(),
  emitNativeChatSendClassified: vi.fn()
}))
vi.mock('./NativeChatComposerActions', () => ({ NativeChatComposerActions: () => null }))
vi.mock('./use-native-chat-skills', () => ({
  useNativeChatSkills: () => ({ status: 'ready', skills: [], error: null, retry: () => {} })
}))
vi.mock('./use-native-chat-external-attachments', () => ({
  useNativeChatExternalAttachments: () => ({
    attachExternalPaths: vi.fn(),
    resolveAttachmentOwner: () => ({ kind: 'local' })
  })
}))

import { NativeChatComposer } from './NativeChatComposer'
import {
  clearNativeChatDraftCacheForTests,
  readNativeChatDraftCache,
  writeNativeChatDraftCache
} from './native-chat-draft-cache'
import {
  clearNativeChatComposerDraftIfUnchanged,
  readNativeChatComposerDraft,
  structuredAgentSessionDraftScopeKey
} from './native-chat-composer-draft-store'

const SESSION = 'session-1'

function composer(handle?: React.RefObject<NativeChatComposerHandle | null>): React.JSX.Element {
  return (
    <NativeChatComposer
      ref={handle}
      terminalTabId={`agent-session:${SESSION}`}
      paneKey={`agent-session:${SESSION}::${SESSION}`}
      draftScopeKey={structuredAgentSessionDraftScopeKey(SESSION)}
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
        runtime: 'remote',
        sessionId: SESSION,
        runtimeEnvironmentId: 'env-1'
      }}
    />
  )
}

function installClipboardText(text: string): void {
  const inert = (): (() => void) => () => {}
  const ui = new Proxy(
    {
      readClipboardText: async () => text,
      readClipboardFilePaths: async () => [],
      readClipboardImageThumbnail: async () => null,
      clipboardHasImage: async () => false
    } as Record<string, unknown>,
    { get: (target, key) => (typeof key === 'string' && key in target ? target[key] : inert) }
  )
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: new Proxy<Record<string, unknown>>(
      { ui },
      { get: (target, key) => (key === 'ui' ? target.ui : inert) }
    )
  })
}

beforeEach(() => {
  clearNativeChatDraftCacheForTests()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('an unsent message in a session chat', () => {
  it('is still in the composer after the user leaves the session and comes back', async () => {
    installClipboardText('half a thought')
    const handle = createRef<NativeChatComposerHandle>()
    const first = render(composer(handle))
    await act(async () => handle.current?.pasteFromClipboard())
    expect(screen.getByRole('textbox').textContent).toContain('half a thought')

    first.unmount()
    render(composer())

    expect(screen.getByRole('textbox').textContent).toContain('half a thought')
    expect(readNativeChatDraftCache(structuredAgentSessionDraftScopeKey(SESSION))).toBe(
      'half a thought'
    )
  })

  it('is gone for good once it was sent', () => {
    const scopeKey = structuredAgentSessionDraftScopeKey(SESSION)
    writeNativeChatDraftCache(scopeKey, 'sent text')
    const first = render(composer())
    expect(screen.getByRole('textbox').textContent).toContain('sent text')
    first.unmount()

    const sent = readNativeChatComposerDraft(scopeKey)
    expect(clearNativeChatComposerDraftIfUnchanged(scopeKey, sent)).toBe(true)

    render(composer())
    expect(screen.getByRole('textbox').textContent).not.toContain('sent text')
  })
})
