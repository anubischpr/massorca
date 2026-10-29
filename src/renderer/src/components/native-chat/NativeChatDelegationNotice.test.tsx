// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as ActivationModule from '@/lib/structured-agent-session-tab-activation'
import { useAppStore } from '@/store'
import type { DelegationNoticePayload } from '../../../../shared/delegated-session-journal'
import type { Tab } from '../../../../shared/tab-types'
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
})
