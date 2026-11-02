import { describe, expect, it, vi } from 'vitest'
import type { StructuredPromptItem } from '@/components/native-chat/structured-agent-session-message-projection'
import { structuredHoverPrompt } from './worktree-card-one-line-structured-session-prompt'

const unanswerable = vi.hoisted(() => ({ value: false }))

vi.mock('../../../../shared/agent-session-approval-subject', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  pendingPromptsAllUnanswerableHere: () => unanswerable.value
}))

function promptItem(itemId: string): StructuredPromptItem {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the code under test returns it untouched.
  return { itemId } as unknown as StructuredPromptItem
}

describe('structuredHoverPrompt', () => {
  it('takes the first pending prompt', () => {
    unanswerable.value = false
    expect(structuredHoverPrompt([promptItem('a'), promptItem('b')])?.itemId).toBe('a')
  })

  it('has nothing to show with no prompt', () => {
    unanswerable.value = false
    expect(structuredHoverPrompt([])).toBeNull()
  })

  it('leaves out prompts that cannot be answered from here', () => {
    unanswerable.value = true
    expect(structuredHoverPrompt([promptItem('a')])).toBeNull()
  })
})
