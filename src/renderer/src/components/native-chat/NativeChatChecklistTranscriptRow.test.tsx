// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { splitNativeChatChecklistUpdate } from '../../../../shared/native-chat-checklist'
import {
  NativeChatAgentCodeBlock,
  NativeChatChecklistUpdateChip
} from './NativeChatChecklistTranscriptRow'

type Owner = { target: { kind: 'local' }; sessionId: string; tabId: string; worktreeId: string }

const owner = vi.hoisted((): { current: Owner | null } => ({
  current: { target: { kind: 'local' }, sessionId: 'chat-1', tabId: 'tab-1', worktreeId: 'wt-1' }
}))
const store = vi.hoisted(() => ({ updateSettings: vi.fn(async () => undefined) }))
const open = vi.hoisted(() => ({ request: vi.fn() }))

vi.mock('./native-chat-visual-owner', () => ({
  useNativeChatVisualOwner: () => owner.current
}))
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: typeof store) => unknown) => selector(store)
}))
vi.mock('./native-chat-open-surface', () => ({
  requestNativeChatOpenSurface: open.request
}))

const FENCE = 'title: QA preview\n- [x] Login works\n- [ ] Logout works'

beforeEach(() => {
  store.updateSettings.mockClear()
  open.request.mockClear()
})

afterEach(() => {
  cleanup()
  owner.current = {
    target: { kind: 'local' },
    sessionId: 'chat-1',
    tabId: 'tab-1',
    worktreeId: 'wt-1'
  }
})

describe('NativeChatAgentCodeBlock', () => {
  it('replaces a checklist fence with a row that opens the checklist in the summary', () => {
    render(<NativeChatAgentCodeBlock language="orca-checklist">{FENCE}</NativeChatAgentCodeBlock>)

    const row = screen.getByRole('button', { name: /Checklist/ })
    expect(row.textContent).toContain('QA preview')
    expect(row.textContent).toContain('1/2')
    expect(screen.queryByText('Login works')).toBeNull()

    fireEvent.click(row)

    expect(store.updateSettings).toHaveBeenCalledWith({ nativeChatSummaryVisible: true })
    expect(open.request).toHaveBeenCalledWith('chat-1', 'checklist')
  })

  it('keeps other fences as code blocks', () => {
    const { container } = render(
      <NativeChatAgentCodeBlock language="ts">const x = 1</NativeChatAgentCodeBlock>
    )

    expect(container.querySelector('[data-code-language="ts"]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /Checklist/ })).toBeNull()
  })

  it('keeps a checklist fence as code when the chat has no visual owner', () => {
    owner.current = null
    const { container } = render(
      <NativeChatAgentCodeBlock language="orca-checklist">{FENCE}</NativeChatAgentCodeBlock>
    )

    expect(container.querySelector('[data-code-language="orca-checklist"]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /Checklist/ })).toBeNull()
  })
})

describe('NativeChatChecklistUpdateChip', () => {
  it('splits the host update from the typed text and shows the update when opened', () => {
    const sent = [
      '<orca-checklist-update>',
      'Checklist "QA preview": changes by the person since your last turn.',
      '- [x] Logout works (checked by the person)',
      '</orca-checklist-update>',
      'Hola, sigue'
    ].join('\n')
    const { update, rest } = splitNativeChatChecklistUpdate(sent)
    expect(rest).toBe('Hola, sigue')
    expect(update).not.toBeNull()

    render(<NativeChatChecklistUpdateChip update={update ?? ''} />)

    expect(screen.queryByText('Sent to the agent with this message')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Checklist changes/ }))

    expect(screen.getByText('Sent to the agent with this message')).toBeTruthy()
    expect(screen.getByText(/Logout works \(checked by the person\)/)).toBeTruthy()
  })
})
