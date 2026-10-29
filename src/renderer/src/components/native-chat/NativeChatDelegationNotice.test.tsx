// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ActivationModule from '@/lib/structured-agent-session-tab-activation'
import { useAppStore } from '@/store'
import type {
  DelegationNoticePayload,
  DelegationStartedPayload
} from '../../../../shared/delegated-session-journal'
import type { Tab } from '../../../../shared/tab-types'
import { DelegatedChildrenProvider } from './delegated-children-context'
import { NativeChatDelegationNotice } from './NativeChatDelegationNotice'

const mocks = vi.hoisted(() => ({ activate: vi.fn(() => true) }))

vi.mock('@/lib/structured-agent-session-tab-activation', async (importOriginal) => ({
  ...(await importOriginal<typeof ActivationModule>()),
  activateStructuredAgentSessionById: mocks.activate
}))

const childTab: Tab = {
  id: 'tab-child',
  entityId: 'child-1',
  groupId: 'group-1',
  worktreeId: 'wt-child',
  contentType: 'agent-session',
  label: 'Explore Gentle Shell v5',
  customLabel: null,
  color: null,
  sortOrder: 0,
  createdAt: 1
}

const finished: DelegationNoticePayload = {
  requestId: 'req-1',
  title: 'Explore Gentle Shell v5',
  status: 'finished',
  outcome: 'succeeded',
  resultSummary: 'Three features worth adopting.',
  childSessionId: 'child-1',
  durationMs: 12 * 60_000
}

afterEach(() => {
  cleanup()
  mocks.activate.mockClear()
  useAppStore.setState({ unifiedTabsByWorktree: {} })
})

describe('NativeChatDelegationNotice', () => {
  it('words a start with the agent, its model and effort, and that Automatic chose it', () => {
    render(
      <NativeChatDelegationNotice
        payload={{
          requestId: 'req-1',
          title: 'Explore',
          status: 'started',
          agent: 'codex',
          model: 'gpt-6.1-sol',
          effort: 'medium',
          childSessionId: 'child-1',
          placement: 'current',
          automatic: true
        }}
      />
    )
    expect(
      screen.getByText(
        'Started child session “Explore” with Codex · gpt-6.1-sol · medium (Automatic)'
      )
    ).toBeInTheDocument()
  })

  it('names the default model and leaves out the effort when the agent runs its own', () => {
    render(
      <NativeChatDelegationNotice
        payload={{
          requestId: 'req-1',
          title: 'Explore',
          status: 'started',
          agent: 'claude',
          model: null,
          effort: null,
          childSessionId: 'child-1',
          placement: 'current',
          automatic: false
        }}
      />
    )
    expect(
      screen.getByText('Started child session “Explore” with Claude · default model')
    ).toBeInTheDocument()
  })

  it('says a request did not start and gives the reason', () => {
    render(
      <NativeChatDelegationNotice
        payload={{
          requestId: 'req-1',
          title: 'Explore',
          status: 'failed',
          reason: 'No agent is connected'
        }}
      />
    )
    expect(
      screen.getByText('Child session “Explore” did not start: No agent is connected')
    ).toBeInTheDocument()
  })

  it('shows a finished child with its duration and result, and no open action when no tab lists it', () => {
    render(<NativeChatDelegationNotice payload={finished} />)
    expect(screen.getByText('Child session finished: Explore Gentle Shell v5')).toBeInTheDocument()
    expect(screen.getByText('12 min · succeeded')).toBeInTheDocument()
    expect(screen.getByText('Three features worth adopting.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open child chat' })).toBeNull()
  })

  it('opens the child in whichever worktree lists it', () => {
    useAppStore.setState({ unifiedTabsByWorktree: { 'wt-parent': [], 'wt-child': [childTab] } })
    render(<NativeChatDelegationNotice payload={finished} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open child chat' }))
    expect(mocks.activate).toHaveBeenCalledWith({ worktreeId: 'wt-child', sessionId: 'child-1' })
  })

  it('words a failed finish, a run under a minute, and no open action without a child', () => {
    render(
      <NativeChatDelegationNotice
        payload={{
          ...finished,
          outcome: 'failed',
          resultSummary: '',
          childSessionId: null,
          durationMs: 30_000
        }}
      />
    )
    expect(screen.getByText('Child session failed: Explore Gentle Shell v5')).toBeInTheDocument()
    expect(screen.getByText('under 1 min · failed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open child chat' })).toBeNull()
  })

  it('words a run past an hour with its minutes, and a whole number of hours without a zero tail', () => {
    const { rerender } = render(
      <NativeChatDelegationNotice payload={{ ...finished, durationMs: 65 * 60_000 }} />
    )
    expect(screen.getByText('1 h 5 min · succeeded')).toBeInTheDocument()

    rerender(<NativeChatDelegationNotice payload={{ ...finished, durationMs: 120 * 60_000 }} />)
    expect(screen.getByText('2 h · succeeded')).toBeInTheDocument()
  })

  describe('while the child runs', () => {
    // Why: a fixed clock keeps "started N min ago" exact however close the test runs to a minute boundary.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-29T12:00:00Z'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })
    const started: DelegationStartedPayload = {
      requestId: 'req-1',
      title: 'Explore',
      status: 'started',
      agent: 'codex',
      model: 'gpt-6.1-sol',
      effort: 'medium',
      childSessionId: 'child-1',
      placement: 'current',
      automatic: true
    }

    it('draws a working child as a live row with its time and an open action', () => {
      useAppStore.setState({ unifiedTabsByWorktree: { 'wt-child': [childTab] } })
      render(
        <DelegatedChildrenProvider
          journalItems={[
            {
              body: { kind: 'status', text: 'Started', delegation: started },
              observedAt: Date.now() - 4 * 60_000
            }
          ]}
        >
          <NativeChatDelegationNotice payload={started} />
        </DelegatedChildrenProvider>
      )
      expect(screen.getByText('Child session working: Explore')).toBeInTheDocument()
      expect(
        screen.getByText('Codex · gpt-6.1-sol · medium (Automatic) · started 4 min ago')
      ).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Open child chat' }))
      expect(mocks.activate).toHaveBeenCalledWith({ worktreeId: 'wt-child', sessionId: 'child-1' })
    })

    it('leaves out the open action while no tab lists the working child', () => {
      render(
        <DelegatedChildrenProvider
          journalItems={[
            { body: { kind: 'status', text: 'Started', delegation: started }, observedAt: 1 }
          ]}
        >
          <NativeChatDelegationNotice payload={started} />
        </DelegatedChildrenProvider>
      )
      expect(screen.getByText('Child session working: Explore')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Open child chat' })).toBeNull()
    })

    it('draws the plain start line once the journal shows the child finished', () => {
      render(
        <DelegatedChildrenProvider
          journalItems={[
            { body: { kind: 'status', text: 'Started', delegation: started }, observedAt: 1 },
            { body: { kind: 'status', text: 'Finished', delegation: finished }, observedAt: 2 }
          ]}
        >
          <NativeChatDelegationNotice payload={started} />
        </DelegatedChildrenProvider>
      )
      expect(
        screen.getByText(
          'Started child session “Explore” with Codex · gpt-6.1-sol · medium (Automatic)'
        )
      ).toBeInTheDocument()
      expect(screen.queryByText(/Child session working/)).toBeNull()
    })
  })
})
