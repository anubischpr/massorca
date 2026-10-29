import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as AgentStateDotModule from '../AgentStateDot'
import type { AgentChildWorkView } from '../../../../shared/agent-status-child-work-view'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import type { AgentChildRowContext } from '../../../../shared/agent-child-row-model'
import type * as ActivationModule from '@/lib/structured-agent-session-tab-activation'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import type { Tab } from '../../../../shared/tab-types'
import type { DelegationNoticePayload } from '../../../../shared/delegated-session-journal'
import { NativeChatCodexBackgroundPanel } from './NativeChatCodexBackgroundPanel'

vi.mock('@/components/AgentChildRowContent', () => ({
  AgentChildRowContent: ({ row }: { row: { name: string; displayState: string } }) => (
    <span>
      {row.name}: {row.displayState}
    </span>
  )
}))
vi.mock('@/components/AgentStateDot', async (importOriginal) => ({
  ...(await importOriginal<typeof AgentStateDotModule>()),
  AgentStateDot: () => <span />
}))
vi.mock('@/hooks/use-now', () => ({ useNow: mocks.useNow }))
const mocks = vi.hoisted(() => ({
  activate: vi.fn(() => true),
  useNow: vi.fn((_intervalMs: number, _enabled?: boolean) => 1_000)
}))
vi.mock('@/lib/structured-agent-session-tab-activation', async (importOriginal) => ({
  ...(await importOriginal<typeof ActivationModule>()),
  activateStructuredAgentSessionById: mocks.activate
}))
afterEach(() => {
  cleanup()
  mocks.activate.mockClear()
  useAppStore.setState({ unifiedTabsByWorktree: {} })
})

const fresh: AgentChildRowContext = {
  parentEvidenceFresh: true,
  transportObservation: 'live',
  parentObservedAt: 1_000,
  hostClockOffsetMs: 0
}
function child(id: string, changes: Partial<AgentChildWorkView> = {}): AgentChildWorkView {
  return {
    id,
    kind: 'command',
    description: id,
    state: 'monitoring',
    membership: 'live',
    firstObservedAt: 100,
    observedAt: 1_000,
    stoppable: false,
    invocation: { invocationId: id, generation: 1 },
    ...changes
  }
}
describe('Codex background sidebar', () => {
  it('omits its own heading when embedded beneath a summary section', () => {
    render(<NativeChatCodexBackgroundPanel roster={null} context={fresh} isVisible embedded />)
    expect(screen.queryByRole('heading', { name: 'Background activity' })).toBeNull()
    expect(screen.getByText('No background work reported.')).toBeDefined()
  })
  it('lists running work ahead of work that has already settled', () => {
    render(
      <NativeChatCodexBackgroundPanel
        context={fresh}
        isVisible
        roster={{
          state: 'monitoring',
          children: [child('finished'), child('running', { state: 'working' })]
        }}
      />
    )
    expect(
      screen
        .getAllByRole('button', { name: /View activity/ })
        .map((button) => button.getAttribute('aria-label'))
    ).toEqual(['View activity: running', 'View activity: finished'])
  })
  it('shows an honest empty state', () => {
    render(<NativeChatCodexBackgroundPanel roster={null} context={fresh} isVisible />)
    expect(screen.getByText('No background work reported.')).toBeDefined()
  })
  it('groups host-owned commands beneath their actual child', () => {
    render(
      <NativeChatCodexBackgroundPanel
        context={fresh}
        isVisible
        roster={{
          state: 'monitoring',
          children: [
            child('main'),
            child('worker', { kind: 'agent', state: 'working' }),
            child('child command', { parentChildWorkId: 'worker' })
          ]
        }}
      />
    )
    expect(screen.getByRole('region', { name: 'Origin unavailable' })).toBeDefined()
    expect(screen.getByRole('region', { name: 'Subagent: worker' }).textContent).toContain(
      'child command'
    )
  })
  it('does not declare completion when host contact is lost', () => {
    const { rerender } = render(
      <NativeChatCodexBackgroundPanel
        context={fresh}
        isVisible
        roster={{ state: 'monitoring', children: [child('command')] }}
      />
    )
    rerender(
      <NativeChatCodexBackgroundPanel
        context={{ ...fresh, transportObservation: 'unverifiable' }}
        isVisible
        roster={{ state: 'monitoring', children: [child('command')] }}
      />
    )
    expect(screen.getByText('command: unverifiable')).toBeDefined()
  })
  it('never labels a native root command as main-owned without provenance', () => {
    render(
      <NativeChatCodexBackgroundPanel
        context={fresh}
        isVisible
        roster={{ state: 'monitoring', children: [child('orphan command')] }}
      />
    )
    expect(screen.getByRole('region', { name: 'Origin unavailable' }).textContent).toContain(
      'orphan command'
    )
    expect(screen.queryByText('Main agent')).toBeNull()
  })
  it('labels only host-confirmed main ownership', () => {
    render(
      <NativeChatCodexBackgroundPanel
        context={fresh}
        isVisible
        roster={{
          state: 'monitoring',
          children: [
            child('main command', { ownership: 'main' }),
            child('lost owner', { ownership: 'unverifiable' })
          ]
        }}
      />
    )
    expect(screen.getByRole('region', { name: 'Main agent' }).textContent).toContain('main command')
    expect(screen.getByRole('region', { name: 'Origin unavailable' }).textContent).toContain(
      'lost owner'
    )
  })
  it('retains host-reported terminal outcomes without pretending legacy ownership', () => {
    render(
      <NativeChatCodexBackgroundPanel
        context={fresh}
        isVisible
        roster={{
          state: 'monitoring',
          settledTasks: [{ id: 'done', kind: 'command', description: 'finished', state: 'done' }]
        }}
      />
    )
    expect(screen.queryByText('finished: done')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '1 finished' }))
    expect(screen.getByText('finished: done')).toBeDefined()
  })
  it('uses the separate command activity view and degrades it after disconnect', () => {
    const views = [
      child('main-live', { ownership: 'main' }),
      child('worker', { kind: 'agent', ownership: 'main' }),
      child('child-live', { ownership: 'child', parentChildWorkId: 'worker' })
    ]
    const { rerender } = render(
      <NativeChatCodexBackgroundPanel
        context={fresh}
        isVisible
        roster={null}
        commandActivity={views}
      />
    )
    expect(screen.getByRole('region', { name: 'Main agent' }).textContent).toContain('main-live')
    expect(screen.getByRole('region', { name: 'Subagent: worker' }).textContent).toContain(
      'child-live'
    )
    rerender(
      <NativeChatCodexBackgroundPanel
        context={{ ...fresh, transportObservation: 'unverifiable' }}
        isVisible
        roster={null}
        commandActivity={views}
      />
    )
    expect(screen.getByText('main-live: unverifiable')).toBeDefined()
    rerender(
      <NativeChatCodexBackgroundPanel
        context={fresh}
        isVisible
        roster={null}
        commandActivity={[]}
      />
    )
    expect(screen.queryByText('main-live: done')).toBeNull()
    expect(screen.getByText('No background work reported.')).toBeDefined()
  })
})

function journal(state: 'running' | 'completed', output: string): AgentJournalRenderItem {
  return {
    itemId: 'command-item',
    revision: state === 'running' ? 1 : 2,
    sequence: 1,
    observedAt: 1_000,
    body: {
      kind: 'tool-call',
      name: 'shell',
      callId: 'call',
      input: { command: 'printf proof' },
      state,
      ...(state === 'completed' ? { exitCode: 0 } : {}),
      output: { head: output, byteLength: output.length, digest: 'd', truncated: false }
    }
  }
}
const ownedCommand = child('tracked', {
  description: 'tracked',
  ownership: 'main',
  providerId: 'codex-command:primary:call'
})

describe('two-level command activity', () => {
  it('opens real output, keeps its completed revision, and returns to the empty compact summary', () => {
    const { rerender } = render(
      <NativeChatCodexBackgroundPanel
        roster={null}
        context={fresh}
        isVisible
        commandActivity={[ownedCommand]}
        journalItems={[journal('running', 'partial proof')]}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'View activity: tracked' }))
    expect(screen.getByRole('complementary', { name: 'Activity details' })).toBeDefined()
    expect(screen.getByText('partial proof')).toBeDefined()
    rerender(
      <NativeChatCodexBackgroundPanel
        roster={null}
        context={fresh}
        isVisible
        commandActivity={[]}
        journalItems={[journal('completed', 'final proof')]}
      />
    )
    expect(screen.getByText('final proof')).toBeDefined()
    expect(screen.getByText('completed')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.queryByText('final proof')).toBeNull()
    expect(screen.getByText('No background work reported.')).toBeDefined()
  })
  it('keeps disconnected details unverifiable rather than fabricating completion', () => {
    const { rerender } = render(
      <NativeChatCodexBackgroundPanel
        roster={null}
        context={fresh}
        isVisible
        commandActivity={[ownedCommand]}
        journalItems={[journal('running', 'received')]}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'View activity: tracked' }))
    rerender(
      <NativeChatCodexBackgroundPanel
        roster={null}
        context={{ ...fresh, transportObservation: 'unverifiable' }}
        isVisible
        commandActivity={[ownedCommand]}
        journalItems={[journal('running', 'received')]}
      />
    )
    expect(screen.getByText('Host activity cannot currently be verified.')).toBeDefined()
    expect(screen.queryByText('completed')).toBeNull()
    expect(screen.getByText('received')).toBeDefined()
  })
  it('shows unavailable for an unowned command instead of another agent output', () => {
    render(
      <NativeChatCodexBackgroundPanel
        roster={null}
        context={fresh}
        isVisible
        commandActivity={[{ ...ownedCommand, ownership: 'unverifiable' }]}
        journalItems={[journal('running', 'wrong output')]}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'View activity: tracked' }))
    expect(screen.getByText('Command output unavailable.')).toBeDefined()
    expect(screen.queryByText('wrong output')).toBeNull()
  })
})

describe('panel-specific recorded agent metadata', () => {
  it('shows grey recorded model and effort in place of duplicated operation text', () => {
    render(
      <NativeChatCodexBackgroundPanel
        roster={null}
        isVisible
        context={fresh}
        commandActivity={[
          child('worker', {
            kind: 'agent',
            description: 'Worker',
            ownership: 'main',
            operation: {
              toolName: 'Bash',
              input: 'duplicate operation',
              basis: 'open',
              observedAt: 1_000
            },
            recordedConfiguration: {
              source: 'recorded-turn-context',
              turnId: 'child-turn',
              observedAt: 1_000,
              model: 'child-model',
              effort: 'medium'
            }
          }),
          child('nested command', { parentChildWorkId: 'worker', ownership: 'child' })
        ]}
      />
    )
    expect(screen.getByText('child-model · medium').className).toContain('text-muted-foreground')
    expect(screen.getByTitle('Recorded turn configuration')).toBeDefined()
    expect(screen.getByTitle('Worker').className).toContain('truncate')
    expect(screen.getByText('child-model · medium').className).not.toContain('truncate')
    expect(screen.getByText('child-model · medium').parentElement?.className).toContain('flex-wrap')
    expect(screen.queryByText(/duplicate operation/)).toBeNull()
    expect(screen.getByRole('region', { name: 'Subagent: Worker' }).textContent).toContain(
      'nested command'
    )
  })
  it('names a subagent by its agent type and states only the configuration it recorded', () => {
    render(
      <NativeChatCodexBackgroundPanel
        roster={null}
        isVisible
        context={fresh}
        commandActivity={[
          child('worker', {
            kind: 'agent',
            description: 'map auth',
            agentType: 'gentle-ai-explore',
            recordedConfiguration: {
              source: 'recorded-turn-context',
              turnId: 't',
              observedAt: 1_000,
              model: 'only-model'
            }
          })
        ]}
      />
    )
    expect(screen.getByRole('heading', { name: 'gentle-ai-explore' })).toBeDefined()
    expect(screen.getByText('only-model')).toBeDefined()
    expect(screen.queryByText(/Effort unavailable/)).toBeNull()
  })
  it('never promotes a legacy model or stale parent setting to recorded effort', () => {
    render(
      <NativeChatCodexBackgroundPanel
        roster={null}
        isVisible
        context={{ ...fresh, transportObservation: 'unverifiable' }}
        commandActivity={[child('worker', { kind: 'agent', model: 'requested-model' })]}
      />
    )
    expect(screen.queryByText(/unavailable ·/)).toBeNull()
    expect(screen.queryByTitle('Recorded turn configuration')).toBeNull()
    expect(screen.queryByText('requested-model')).toBeNull()
    expect(screen.getByText('Host activity cannot currently be verified.')).toBeDefined()
  })
})

it('uses localized accessible labels and interpolates only the activity name', async () => {
  const localized = createInstance()
  await localized.init({
    lng: 'test',
    resources: {
      test: {
        translation: {
          components: {
            nativeChatBackground: {
              title: 'Localized activity',
              viewActivity: 'Inspect {{label}}'
            }
          }
        }
      }
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false }
  })
  render(
    <I18nextProvider i18n={localized}>
      <NativeChatCodexBackgroundPanel
        isVisible
        context={fresh}
        roster={null}
        commandActivity={[child('local-command', { ownership: 'main' })]}
      />
    </I18nextProvider>
  )
  expect(screen.getByRole('complementary', { name: 'Localized activity' })).toBeDefined()
  expect(screen.getByRole('button', { name: 'Inspect local-command' })).toBeDefined()
})

describe('background task Stop controls', () => {
  const live = (id: string, changes: Partial<AgentChildWorkView> = {}) =>
    child(id, { state: 'working', stoppable: true, providerId: `provider-${id}`, ...changes })
  const stopHandlers = (supportsTaskStop: boolean | undefined, onStop = vi.fn()) => ({
    supportsTaskStop,
    stoppingTaskIds: new Set<string>(),
    onStop
  })
  function renderStops(
    activity: AgentChildWorkView[],
    stop: ReturnType<typeof stopHandlers> | undefined
  ) {
    render(
      <TooltipProvider>
        <NativeChatCodexBackgroundPanel
          context={fresh}
          isVisible
          roster={null}
          commandActivity={activity}
          stop={stop}
        />
      </TooltipProvider>
    )
  }

  it('draws a Stop that names each live task by its provider id, and none on a finished one', () => {
    const onStop = vi.fn()
    renderStops(
      [
        live('running'),
        live('done-one', {
          membership: 'settled',
          state: 'done',
          outcome: 'succeeded',
          settledAt: 900
        })
      ],
      stopHandlers(true, onStop)
    )

    fireEvent.click(screen.getByRole('button', { name: 'Stop running' }))
    expect(onStop).toHaveBeenCalledWith('provider-running')

    fireEvent.click(screen.getByRole('button', { name: '1 finished' }))
    expect(screen.getByText('done-one: done')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Stop done-one' })).toBeNull()
  })

  it('draws a disabled Stop that says why when the provider cannot stop', () => {
    renderStops([live('running')], stopHandlers(false))
    const stop = screen.getByRole('button', { name: 'Stop running' })
    expect(stop.hasAttribute('disabled')).toBe(true)
    expect(stop.getAttribute('aria-description')).toBe(
      'This provider cannot stop background tasks.'
    )
  })

  it('draws a disabled Stop with its own reason for a task the host cannot target', () => {
    renderStops([live('in-turn', { stoppable: false })], stopHandlers(true))
    const stop = screen.getByRole('button', { name: 'Stop in-turn' })
    expect(stop.hasAttribute('disabled')).toBe(true)
    expect(stop.getAttribute('aria-description')).toBe('This task cannot be stopped on its own.')
  })

  it('draws no Stop from a host that predates the field, or when no stop is handed in', () => {
    renderStops([live('running')], stopHandlers(undefined))
    expect(screen.queryByRole('button', { name: 'Stop running' })).toBeNull()
    expect(screen.getByRole('button', { name: 'View activity: running' })).toBeDefined()

    cleanup()
    renderStops([live('running')], undefined)
    expect(screen.queryByRole('button', { name: 'Stop running' })).toBeNull()
  })

  it('keeps the activity button beside a Stop, so the row still opens its activity', () => {
    renderStops([live('running')], stopHandlers(true))
    fireEvent.click(screen.getByRole('button', { name: 'View activity: running' }))
    expect(screen.getByRole('complementary', { name: 'Activity details' })).toBeDefined()
  })
})

describe('subagent detail view', () => {
  const recorded = (model: string, effort?: string) => ({
    source: 'recorded-turn-context' as const,
    turnId: 't',
    observedAt: 1_000,
    model,
    ...(effort ? { effort } : {})
  })
  const childCases: [string, Partial<AgentChildWorkView>, string[], string[]][] = [
    [
      'Codex',
      {
        description: 'resumen_carpeta',
        agentType: 'explorer',
        state: 'done',
        membership: 'settled',
        settledAt: 5_100,
        recordedConfiguration: recorded('gpt-6.1-sol', 'high'),
        lastMessage: 'Resumen listo'
      },
      ['gpt-6.1-sol · high', 'Resumen listo', 'Result'],
      []
    ],
    [
      'Claude Task',
      {
        description: 'Map the auth flow',
        agentType: 'Explore',
        state: 'working',
        lastMessage: 'Reading lib/auth.ts'
      },
      ['Explore', 'Reading lib/auth.ts', 'Latest'],
      ['Result']
    ],
    [
      'Gentle Shell worker',
      {
        name: 'gentle-ai-explore',
        description: 'summarize current project',
        agentType: 'gentle-ai-explore',
        state: 'done',
        membership: 'settled',
        settledAt: 70_000,
        lastMessage: 'Project summary'
      },
      ['gentle-ai-explore', 'Project summary'],
      ['Command output unavailable.']
    ]
  ]
  it.each(childCases)(
    'describes a %s child without command wording',
    (_name, changes, present, absent) => {
      render(
        <NativeChatCodexBackgroundPanel
          roster={null}
          isVisible
          context={fresh}
          commandActivity={[child('agent-1', { kind: 'agent', ...changes })]}
        />
      )
      if (changes.membership === 'settled') {
        fireEvent.click(screen.getByRole('button', { name: '1 finished' }))
      }
      fireEvent.click(screen.getByRole('button', { name: /View activity/ }))
      const details = screen.getByRole('complementary', { name: 'Activity details' })
      for (const text of present) {
        expect(details.textContent).toContain(text)
      }
      for (const text of absent) {
        expect(details.textContent).not.toContain(text)
      }
      expect(details.textContent).not.toContain('Command output unavailable.')
      expect(details.textContent).not.toContain('unavailable')
      const title = changes.description ?? ''
      expect(details.textContent?.split(title).length).toBe(2)
    }
  )
})

describe('finished history across a detail view', () => {
  it.each(['agent', 'command'] as const)(
    'keeps the expanded %s history open, and refocuses the row, after Back',
    (kind) => {
      render(
        <NativeChatCodexBackgroundPanel
          roster={null}
          isVisible
          context={fresh}
          commandActivity={[
            child('done-one', { kind, state: 'done', membership: 'settled', settledAt: 500 })
          ]}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: '1 finished' }))
      const row = screen.getByRole('button', { name: 'View activity: done-one' })
      fireEvent.click(row)
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))
      expect(screen.getByRole('button', { name: '1 finished' }).getAttribute('aria-expanded')).toBe(
        'true'
      )
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'View activity: done-one' })
      )
    }
  )
})

describe('child sessions in the background popover', () => {
  const childTab: Tab = {
    id: 'tab-child',
    entityId: 'child-1',
    groupId: 'group-1',
    worktreeId: 'wt-child',
    contentType: 'agent-session',
    label: 'Explore routing',
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 1
  }
  const running: DelegationNoticePayload = {
    requestId: 'req-1',
    title: 'Explore routing',
    status: 'started',
    agent: 'codex',
    model: 'gpt-6.1-sol',
    effort: 'medium',
    childSessionId: 'child-1',
    placement: 'current',
    automatic: true
  }
  const settled: DelegationNoticePayload = {
    ...running,
    requestId: 'req-2',
    title: 'Lint sweep',
    childSessionId: 'child-2'
  }
  const settledFinish: DelegationNoticePayload = {
    requestId: 'req-2',
    title: 'Lint sweep',
    status: 'finished',
    outcome: 'succeeded',
    resultSummary: '',
    childSessionId: 'child-2',
    durationMs: null
  }
  const delegationItem = (delegation: DelegationNoticePayload, observedAt: number) =>
    ({
      itemId: `${delegation.requestId}-${delegation.status}`,
      revision: 1,
      sequence: observedAt,
      observedAt,
      body: { kind: 'status', text: delegation.title, delegation }
    }) satisfies AgentJournalRenderItem

  it('lists a running child with an open action that opens its chat', () => {
    useAppStore.setState({ unifiedTabsByWorktree: { 'wt-child': [childTab] } })
    render(
      <NativeChatCodexBackgroundPanel
        roster={null}
        context={fresh}
        isVisible
        journalItems={[delegationItem(running, 400)]}
      />
    )
    expect(screen.getByRole('heading', { name: 'Child sessions' })).toBeDefined()
    expect(screen.getByText('Codex · working · under 1 min')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Open child chat: Explore routing' }))
    expect(mocks.activate).toHaveBeenCalledWith({ worktreeId: 'wt-child', sessionId: 'child-1' })
  })

  it('moves a finished child under the Finished group, with no open action when no tab lists it', () => {
    render(
      <NativeChatCodexBackgroundPanel
        roster={null}
        context={fresh}
        isVisible
        journalItems={[delegationItem(settled, 100), delegationItem(settledFinish, 200)]}
      />
    )
    expect(screen.queryByRole('heading', { name: 'Child sessions' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '1 finished' }))
    expect(screen.getByText('Lint sweep')).toBeDefined()
    expect(screen.getByText('Codex · finished')).toBeDefined()
    expect(screen.queryByRole('button', { name: /Open child chat/ })).toBeNull()
  })

  it('keeps child sessions out of the subagent list', () => {
    render(
      <NativeChatCodexBackgroundPanel
        roster={null}
        context={fresh}
        isVisible
        section="agents"
        journalItems={[delegationItem(running, 400)]}
      />
    )
    expect(screen.queryByText('Explore routing')).toBeNull()
  })

  it('lists nothing for a request that never started', () => {
    const failedStart: DelegationNoticePayload = {
      requestId: 'req-3',
      title: 'Never ran',
      status: 'failed',
      reason: 'no capacity'
    }
    render(
      <NativeChatCodexBackgroundPanel
        roster={null}
        context={fresh}
        isVisible
        journalItems={[delegationItem(failedStart, 100)]}
      />
    )
    expect(screen.queryByRole('heading', { name: 'Child sessions' })).toBeNull()
    expect(screen.queryByText('Never ran')).toBeNull()
    expect(screen.getByText('No background work reported.')).toBeDefined()
  })

  it('shares one Finished group between finished children and finished commands', () => {
    render(
      <NativeChatCodexBackgroundPanel
        roster={null}
        context={fresh}
        isVisible
        commandActivity={[child('build', { membership: 'settled', state: 'done', settledAt: 900 })]}
        journalItems={[delegationItem(settled, 100), delegationItem(settledFinish, 200)]}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '2 finished' }))
    expect(screen.getByText('Lint sweep')).toBeDefined()
    expect(screen.getByRole('button', { name: 'View activity: build' })).toBeDefined()
    expect(screen.queryByRole('button', { name: '1 finished' })).toBeNull()
  })

  it('ticks the child clock only while the popover is visible', () => {
    const { rerender } = render(
      <NativeChatCodexBackgroundPanel
        roster={null}
        context={fresh}
        isVisible={false}
        journalItems={[delegationItem(running, 400)]}
      />
    )
    expect(mocks.useNow).toHaveBeenLastCalledWith(1_000, false)
    rerender(
      <NativeChatCodexBackgroundPanel
        roster={null}
        context={fresh}
        isVisible
        journalItems={[delegationItem(running, 400)]}
      />
    )
    expect(mocks.useNow).toHaveBeenLastCalledWith(1_000, true)
  })
})
