import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as AgentStateDotModule from '../AgentStateDot'
import type { AgentChildWorkView } from '../../../../shared/agent-status-child-work-view'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import type { AgentChildRowContext } from '../../../../shared/agent-child-row-model'
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
vi.mock('@/hooks/use-now', () => ({ useNow: () => 1_000 }))
afterEach(cleanup)

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
    expect(screen.getByText('Origin unavailable')).toBeDefined()
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
  it('never promotes a legacy model or stale parent setting to recorded effort', () => {
    render(
      <NativeChatCodexBackgroundPanel
        roster={null}
        isVisible
        context={{ ...fresh, transportObservation: 'unverifiable' }}
        commandActivity={[child('worker', { kind: 'agent', model: 'requested-model' })]}
      />
    )
    expect(screen.getByText('Model unavailable · Effort unavailable')).toBeDefined()
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
