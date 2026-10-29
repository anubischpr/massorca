import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DelegationNoticePayload } from '../../../src/shared/delegated-session-journal'
import { renderedTexts } from '../test-support/rendered-texts'
import { MobileNativeChatDelegationNotice } from './MobileNativeChatDelegationNotice'
import {
  MobileDelegatedChildContext,
  type MobileDelegatedChildAccess
} from './mobile-delegated-child-access'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  AlertCircle: 'AlertCircle',
  Check: 'Check',
  CornerDownRight: 'CornerDownRight'
}))

const finished: DelegationNoticePayload = {
  requestId: 'request-1',
  title: 'Explore Gentle Shell v5',
  status: 'finished',
  outcome: 'succeeded',
  resultSummary: 'The features worth adopting.',
  childSessionId: 'child-1',
  durationMs: 12 * 60_000
}

describe('MobileNativeChatDelegationNotice', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function mount(payload: DelegationNoticePayload, access: MobileDelegatedChildAccess | null) {
    act(() => {
      renderer = create(
        createElement(
          MobileDelegatedChildContext.Provider,
          { value: access },
          createElement(MobileNativeChatDelegationNotice, { payload })
        )
      )
    })
    return renderer!
  }

  function texts(): string[] {
    return renderedTexts(renderer!.toJSON())
  }

  function openButton() {
    return renderer!.root.findAllByProps({ accessibilityLabel: 'Open child chat' })
  }

  it('draws the start line in words the desktop uses', () => {
    mount(
      {
        requestId: 'request-1',
        title: 'Explore Gentle Shell v5',
        status: 'started',
        agent: 'codex',
        model: null,
        effort: 'medium',
        childSessionId: 'child-1',
        placement: 'current',
        automatic: false
      },
      null
    )

    expect(texts()).toEqual([
      'Started child session “Explore Gentle Shell v5” with Codex · default model · medium'
    ])
  })

  it('draws a failed start in the error colour, naming the reason', () => {
    mount({ requestId: 'request-1', title: 'Explore', status: 'failed', reason: 'no agent' }, null)

    expect(texts()).toEqual(['Child session “Explore” did not start: no agent'])
  })

  it('draws the finished card with its heading, title, meta and result', () => {
    mount(finished, null)

    expect(texts()).toEqual([
      'Child session finished',
      'Explore Gentle Shell v5',
      '12 min · succeeded',
      'The features worth adopting.'
    ])
  })

  it('draws no Open control without a child tab to open', () => {
    mount(finished, null)
    expect(openButton()).toHaveLength(0)

    act(() => renderer?.unmount())
    mount(finished, { hasChild: () => false, openChild: vi.fn() })
    expect(openButton()).toHaveLength(0)
  })

  it('draws no Open control when the finished notice names no child', () => {
    mount({ ...finished, childSessionId: null }, { hasChild: () => true, openChild: vi.fn() })

    expect(openButton()).toHaveLength(0)
  })

  it('asks the host for rows once when the child is not held here, and not when it is', () => {
    const refreshAgentRows = vi.fn()
    mount(finished, { hasChild: () => false, openChild: vi.fn(), refreshAgentRows })
    expect(refreshAgentRows).toHaveBeenCalledTimes(1)

    act(() => renderer?.unmount())
    const held = vi.fn()
    mount(finished, { hasChild: () => true, openChild: vi.fn(), refreshAgentRows: held })
    expect(held).not.toHaveBeenCalled()
  })

  it('asks the host for rows once a child held here is no longer listed', () => {
    const refreshAgentRows = vi.fn()
    mount(finished, { hasChild: () => true, openChild: vi.fn(), refreshAgentRows })
    expect(refreshAgentRows).not.toHaveBeenCalled()

    act(() => {
      renderer?.update(
        createElement(
          MobileDelegatedChildContext.Provider,
          {
            value: { hasChild: () => false, openChild: vi.fn(), refreshAgentRows }
          },
          createElement(MobileNativeChatDelegationNotice, { payload: finished })
        )
      )
    })
    expect(refreshAgentRows).toHaveBeenCalledTimes(1)
  })

  it('asks the host for rows at most once per child, however often the chat re-renders', () => {
    const refreshAgentRows = vi.fn()
    const missing = () => ({ hasChild: () => false, openChild: vi.fn(), refreshAgentRows })
    mount(finished, missing())
    expect(refreshAgentRows).toHaveBeenCalledTimes(1)

    act(() => {
      renderer?.update(
        createElement(
          MobileDelegatedChildContext.Provider,
          { value: missing() },
          createElement(MobileNativeChatDelegationNotice, { payload: finished })
        )
      )
    })
    expect(refreshAgentRows).toHaveBeenCalledTimes(1)
  })

  it('opens the child through the chat access when its tab is here', async () => {
    const openChild = vi.fn()
    mount(finished, { hasChild: (id) => id === 'child-1', openChild })

    await act(async () => openButton()[0]!.props.onPress())

    expect(openChild).toHaveBeenCalledWith('child-1')
  })

  it('draws a failed finish with the failed heading and no duration when none came', () => {
    mount({ ...finished, outcome: 'failed', durationMs: null, resultSummary: '' }, null)

    expect(texts()).toEqual(['Child session failed', 'Explore Gentle Shell v5', 'failed'])
  })
})
