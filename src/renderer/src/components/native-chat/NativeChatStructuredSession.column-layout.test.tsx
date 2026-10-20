// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'

const { mocks, moduleFactories, resetStructuredSessionMocks } = await vi.hoisted(async () =>
  (await import('./NativeChatStructuredSession.test-harness')).createStructuredSessionMocks()
)

vi.mock('@/lib/structured-agent-session-launch', () =>
  moduleFactories.structuredAgentSessionLaunch()
)
vi.mock('@/runtime/structured-agent-session-client', () =>
  moduleFactories.structuredAgentSessionClient()
)
vi.mock('./use-structured-agent-session', () => moduleFactories.useStructuredAgentSession())
vi.mock('./use-native-chat-font-size', () => moduleFactories.useNativeChatFontSize())
vi.mock('./use-native-chat-file-link-context', () => moduleFactories.useNativeChatFileLinkContext())
vi.mock('./use-native-chat-file-link-click', () => moduleFactories.useNativeChatFileLinkClick())
vi.mock('./NativeChatMessageList', () => moduleFactories.nativeChatMessageList())
vi.mock('./NativeChatComposer', () => moduleFactories.nativeChatComposer())
vi.mock('./NativeChatEmptyState', () => moduleFactories.nativeChatEmptyState())
vi.mock('./NativeChatApprovalCard', () => moduleFactories.nativeChatApprovalCard())
vi.mock('./NativeChatQuestionCard', () => moduleFactories.nativeChatQuestionCard())

import { NativeChatStructuredSession } from './NativeChatStructuredSession'

const STRIP = '[data-native-chat-background-tasks]'

function sessionView(): React.JSX.Element {
  return (
    <TooltipProvider>
      <NativeChatStructuredSession
        isVisible
        isFocusedGroup
        tabId="structured-tab-column"
        sessionId="session-column"
        target={{ kind: 'local' }}
        agent="codex"
      />
    </TooltipProvider>
  )
}

// Why: the summary rail is a sibling of the transcript column, so the bottom dock must
// live in that column; otherwise the composer centers on the full pane and drifts from the
// transcript by half the rail width.
describe('NativeChatStructuredSession bottom dock column', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
    resetStructuredSessionMocks()
  })

  it('keeps the composer in the same column as the transcript, outside the summary rail', () => {
    render(sessionView())

    const composer = screen.getByTestId('structured-composer')
    const transcript = screen.getByTestId('message-list')
    const summary = screen.getByRole('complementary', { name: 'Chat summary' })
    const transcriptColumn = summary.previousElementSibling

    expect(transcriptColumn).not.toBeNull()
    expect(transcriptColumn?.contains(transcript)).toBe(true)
    expect(transcriptColumn?.contains(composer)).toBe(true)
    expect(summary.contains(composer)).toBe(false)
  })

  it('keeps the background task strip in the transcript column too', () => {
    mocks.monitoringBackgroundTasks = true
    mocks.backgroundTasks = [{ id: 'task-agent', kind: 'agent' }]
    render(sessionView())

    const strip = document.querySelector(STRIP)
    const summary = screen.getByRole('complementary', { name: 'Chat summary' })
    const transcriptColumn = summary.previousElementSibling

    expect(strip).not.toBeNull()
    expect(transcriptColumn?.contains(strip)).toBe(true)
    expect(summary.contains(strip)).toBe(false)
  })
})
