// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ActivationModule from '@/lib/structured-agent-session-tab-activation'
import { useAppStore } from '@/store'
import type {
  DelegationNoticePayload,
  DelegationStartedPayload
} from '../../../../shared/delegated-session-journal'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import type { Tab } from '../../../../shared/tab-types'
import { usePrototypeViewStore } from '../prototypes/prototype-view-store'
import { DelegatedChildrenProvider } from './delegated-children-context'
import { NativeChatDelegationNotice } from './NativeChatDelegationNotice'

const mocks = vi.hoisted(() => ({
  activate: vi.fn(() => true),
  reveal: vi.fn(() => true),
  chatName: vi.fn((): string | null => null),
  prototypeSets: new Array<PrototypeListedSet>()
}))

vi.mock('../prototypes/prototype-host-targets', () => ({
  listPrototypeSetsFromAllHosts: async () => ({
    answered: true,
    sets: mocks.prototypeSets,
    designSystems: [],
    proposals: []
  })
}))

vi.mock('@/lib/structured-agent-session-tab-activation', async (importOriginal) => ({
  ...(await importOriginal<typeof ActivationModule>()),
  activateStructuredAgentSessionById: mocks.activate
}))

vi.mock('@/runtime/structured-conversation-name', () => ({
  useStructuredChatTabConversationName: mocks.chatName
}))

vi.mock('@/lib/worktree-activation', () => ({ activateAndRevealWorktree: mocks.reveal }))

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

function childSet(requestId: string, sessionId: string, createdAt: string): PrototypeListedSet {
  return {
    requestId,
    sessionId,
    agent: 'codex',
    worktreeId: 'wt-child',
    chatTitle: 'Checkout redesign',
    originalPrompt: `Prototype ${requestId}`,
    createdAt,
    count: 3,
    directions: [],
    origin: { sessionId: 'parent-1' }
  }
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
  mocks.reveal.mockClear()
  mocks.chatName.mockReset()
  mocks.chatName.mockReturnValue(null)
  mocks.prototypeSets = []
  useAppStore.setState({ unifiedTabsByWorktree: {}, activeWorktreeId: null })
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

  it('links the prototype a child made, from its finish in the parent, to the same set', async () => {
    mocks.prototypeSets = [
      childSet('req-other', 'someone-else', '2026-11-02T09:00:00.000Z'),
      childSet('req-proto', 'child-1', '2026-11-02T10:00:00.000Z')
    ]
    render(<NativeChatDelegationNotice payload={finished} />)
    const cards = await screen.findAllByText('Open in Prototypes ›')
    expect(cards).toHaveLength(1)
    fireEvent.click(cards[0])
    expect(usePrototypeViewStore.getState().selectedRequestId).toBe('req-proto')
    expect(useAppStore.getState().activeView).toBe('prototypes')
  })

  it('shows no prototype link for a child that made none', async () => {
    mocks.prototypeSets = [childSet('req-other', 'someone-else', '2026-11-02T09:00:00.000Z')]
    render(<NativeChatDelegationNotice payload={finished} />)
    await waitFor(() => expect(screen.queryByText('Open in Prototypes ›')).toBeNull())
  })

  it('opens the child in whichever worktree lists it', () => {
    useAppStore.setState({ unifiedTabsByWorktree: { 'wt-parent': [], 'wt-child': [childTab] } })
    render(<NativeChatDelegationNotice payload={finished} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open child chat' }))
    expect(mocks.activate).toHaveBeenCalledWith({ worktreeId: 'wt-child', sessionId: 'child-1' })
  })

  it('titles a finished child with its generated name once it has one', () => {
    useAppStore.setState({ unifiedTabsByWorktree: { 'wt-child': [childTab] } })
    mocks.chatName.mockReturnValue('Clinical audit screen design')
    render(<NativeChatDelegationNotice payload={finished} />)
    expect(screen.getByText('Child session finished: Clinical audit screen design')).toBeInTheDocument()
  })

  it('switches to the worktree a child lives in, so the click visibly opens it', () => {
    useAppStore.setState({
      unifiedTabsByWorktree: { 'wt-parent': [], 'wt-child': [childTab] },
      activeWorktreeId: 'wt-parent'
    })
    render(<NativeChatDelegationNotice payload={finished} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open child chat' }))
    expect(mocks.reveal).toHaveBeenCalledWith('wt-child')
  })

  it('stays in the worktree when the child is already in the one on screen', () => {
    useAppStore.setState({
      unifiedTabsByWorktree: { 'wt-child': [childTab] },
      activeWorktreeId: 'wt-child'
    })
    render(<NativeChatDelegationNotice payload={finished} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open child chat' }))
    expect(mocks.activate).toHaveBeenCalledWith({ worktreeId: 'wt-child', sessionId: 'child-1' })
    expect(mocks.reveal).not.toHaveBeenCalled()
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
