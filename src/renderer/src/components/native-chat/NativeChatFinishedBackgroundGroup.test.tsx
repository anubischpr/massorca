// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as AgentStateDotModule from '../AgentStateDot'
import type { AgentChildRowContext } from '../../../../shared/agent-child-row-model'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import type { AgentChildWorkView } from '../../../../shared/agent-status-child-work-view'
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
function view(id: string, changes: Partial<AgentChildWorkView> = {}): AgentChildWorkView {
  return {
    id,
    kind: 'command',
    description: id,
    state: 'working',
    membership: 'live',
    firstObservedAt: 100,
    observedAt: 1_000,
    stoppable: false,
    invocation: { invocationId: id, generation: 1 },
    ownership: 'main',
    ...changes
  }
}
function finished(id: string, changes: Partial<AgentChildWorkView> = {}): AgentChildWorkView {
  return view(id, {
    state: 'done',
    membership: 'settled',
    outcome: 'succeeded',
    settledAt: 900,
    ...changes
  })
}
function commandJournal(output: string): AgentJournalRenderItem {
  return {
    itemId: 'command-item',
    revision: 2,
    sequence: 1,
    observedAt: 1_000,
    body: {
      kind: 'tool-call',
      name: 'shell',
      callId: 'call',
      input: { command: 'printf proof' },
      state: 'completed',
      exitCode: 0,
      output: { head: output, byteLength: output.length, digest: 'd', truncated: false }
    }
  }
}
function panel(views: AgentChildWorkView[], section: 'agents' | 'commands' = 'commands') {
  return (
    <NativeChatCodexBackgroundPanel
      roster={null}
      context={fresh}
      isVisible
      embedded
      section={section}
      commandActivity={views}
      journalItems={[commandJournal('final proof')]}
    />
  )
}

describe('finished background work group', () => {
  it('lists running work and keeps finished work behind a collapsed count', () => {
    render(panel([view('running'), finished('done-one'), finished('done-two', { state: 'idle' })]))
    expect(screen.getByText('running: working')).toBeDefined()
    expect(screen.getByRole('button', { name: '2 finished' }).getAttribute('aria-expanded')).toBe(
      'false'
    )
    expect(screen.queryByText('done-one: done')).toBeNull()
  })
  it('reveals finished work when the group is opened', () => {
    render(panel([view('running'), finished('done-one')]))
    fireEvent.click(screen.getByRole('button', { name: '1 finished' }))
    expect(screen.getByText('done-one: done')).toBeDefined()
    expect(screen.getByRole('button', { name: '1 finished' }).getAttribute('aria-expanded')).toBe(
      'true'
    )
  })
  it('opens the output detail of a finished task', () => {
    render(panel([finished('tracked', { providerId: 'codex-command:primary:call' })]))
    fireEvent.click(screen.getByRole('button', { name: '1 finished' }))
    fireEvent.click(screen.getByRole('button', { name: 'View activity: tracked' }))
    expect(screen.getByRole('complementary', { name: 'Activity details' })).toBeDefined()
    expect(screen.getByText('final proof')).toBeDefined()
  })
  it('omits the group when nothing has finished', () => {
    render(panel([view('running')]))
    expect(screen.queryByRole('button', { name: /finished/ })).toBeNull()
  })
  it('keeps a settled owner that still owns running work out of the finished group', () => {
    render(
      panel([
        finished('owner', { kind: 'agent' }),
        view('owned-shell', { parentChildWorkId: 'owner', ownership: 'child' })
      ])
    )
    expect(screen.queryByRole('button', { name: /finished/ })).toBeNull()
  })
  it('groups finished subagents in the agents section without touching commands', () => {
    render(
      panel(
        [
          view('live-agent', { kind: 'agent' }),
          finished('old-agent', { kind: 'agent' }),
          finished('old-cmd')
        ],
        'agents'
      )
    )
    expect(screen.getByRole('region', { name: 'Subagent: live-agent' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '1 finished' }))
    expect(screen.getByRole('button', { name: 'View activity: old-agent' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'View activity: old-cmd' })).toBeNull()
  })
})
