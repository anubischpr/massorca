import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  emptyDesignSystemViewState,
  type DesignSystemViewState
} from '../../../src/shared/prototype-design-system-view-state'
import { addDraftComponent } from '../../../src/shared/prototype-design-system-draft'
import {
  mobileDesignSystemDraftCount,
  mobileDesignSystemDraftText,
  mobileDesignSystemNothingToSend,
  sendMobileDesignSystemText,
  type MobileDesignSystemSendFlow
} from './mobile-prototype-design-system-send'
import { NEXUS_SYSTEM, nexusContent, nexusSet } from './mobile-prototype-design-system.test-fixture'

const chat = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('./mobile-prototype-chat-text-send', () => ({ sendMobilePrototypeText: chat.send }))

const TARGET = { sessionId: 'session-nexus', agent: 'codex' as const, worktreeId: 'wt-1' }

function flowOver(initial: DesignSystemViewState): {
  flow: MobileDesignSystemSendFlow
  current: () => DesignSystemViewState
} {
  let state = initial
  return {
    flow: {
      client: null,
      target: TARGET,
      getState: () => state,
      update: (transform) => {
        state = transform(state)
      }
    },
    current: () => state
  }
}

function withAddedComponent(): DesignSystemViewState {
  const state = emptyDesignSystemViewState()
  return { ...state, draft: addDraftComponent(state.draft, 'Toast') }
}

beforeEach(() => {
  chat.send.mockReset()
})

describe('the draft text', () => {
  const content = nexusContent()

  it('asks for the next version, lists the changes and rebuilds the sets built on this one', () => {
    const text = mobileDesignSystemDraftText({
      system: NEXUS_SYSTEM,
      content,
      state: { ...withAddedComponent(), freeText: 'Calmer tone' },
      rebuildSets: [nexusSet()]
    })
    expect(text).toContain('Update the design system to v3.')
    expect(text).toContain('Design system · components')
    expect(text).toContain('add: Add component: Toast')
    expect(text).toContain('Rebuild Liquidaciones fases 1-3 on v3.')
    expect(text).toContain('Calmer tone')
  })

  it('leaves the rebuild out when the option is off', () => {
    const text = mobileDesignSystemDraftText({
      system: NEXUS_SYSTEM,
      content,
      state: { ...withAddedComponent(), rebuild: false },
      rebuildSets: [nexusSet()]
    })
    expect(text).not.toContain('Rebuild ')
  })

  it('counts the changes, and sends nothing for no change and no text', () => {
    expect(mobileDesignSystemDraftCount({ content, state: withAddedComponent() })).toBe(1)
    const empty = emptyDesignSystemViewState()
    expect(mobileDesignSystemNothingToSend({ content, state: empty })).toBe(true)
    expect(mobileDesignSystemNothingToSend({ content, state: { ...empty, freeText: ' ' } })).toBe(
      true
    )
    expect(mobileDesignSystemNothingToSend({ content, state: { ...empty, freeText: 'Hi' } })).toBe(
      false
    )
  })
})

describe('sendMobileDesignSystemText', () => {
  it('clears the draft and the text when the chat takes the message', async () => {
    chat.send.mockResolvedValue(true)
    const { flow, current } = flowOver({ ...withAddedComponent(), freeText: 'Calmer tone' })
    expect(await sendMobileDesignSystemText(flow, 'draft', 'Update')).toBe(true)
    expect(chat.send).toHaveBeenCalledWith(null, TARGET, 'Update')
    expect(current().draft.added).toEqual([])
    expect(current().freeText).toBe('')
    expect(current().sending).toBe(false)
    expect(current().failed).toBeNull()
  })

  it('keeps the draft and marks the failure when the chat refuses', async () => {
    chat.send.mockResolvedValue(false)
    const { flow, current } = flowOver({ ...withAddedComponent(), freeText: 'Calmer tone' })
    expect(await sendMobileDesignSystemText(flow, 'draft', 'Update')).toBe(false)
    expect(current().draft.added).toEqual(['Toast'])
    expect(current().freeText).toBe('Calmer tone')
    expect(current().failed).toBe('draft')
    expect(current().sending).toBe(false)
  })

  it('reads a send that throws as a refusal', async () => {
    chat.send.mockRejectedValue(new Error('offline'))
    const { flow, current } = flowOver(withAddedComponent())
    expect(await sendMobileDesignSystemText(flow, 'draft', 'Update')).toBe(false)
    expect(current().failed).toBe('draft')
    expect(current().draft.added).toEqual(['Toast'])
  })

  it('sends nothing without a chat or while another send is in flight', async () => {
    const none = flowOver(withAddedComponent())
    expect(
      await sendMobileDesignSystemText({ ...none.flow, target: undefined }, 'draft', 'x')
    ).toBe(false)
    const busy = flowOver({ ...withAddedComponent(), sending: true })
    expect(await sendMobileDesignSystemText(busy.flow, 'draft', 'x')).toBe(false)
    expect(chat.send).not.toHaveBeenCalled()
  })
})
