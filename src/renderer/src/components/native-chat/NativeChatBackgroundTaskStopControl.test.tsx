// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentChildWorkView } from '../../../../shared/agent-status-child-work-view'
import {
  buildAgentChildRowModels,
  type AgentChildRowContext,
  type AgentChildRowModel
} from '../../../../shared/agent-child-row-model'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NativeChatBackgroundTaskStopControl } from './NativeChatBackgroundTaskStopControl'

afterEach(cleanup)

const FRESH: AgentChildRowContext = {
  parentEvidenceFresh: true,
  transportObservation: 'live',
  parentObservedAt: 1_000,
  hostClockOffsetMs: 0
}

function liveRow(changes: Partial<AgentChildWorkView> = {}): AgentChildRowModel {
  const [row] = buildAgentChildRowModels(
    [
      {
        id: 'child-1',
        providerId: 'provider-1',
        kind: 'command',
        description: 'sleep 90',
        state: 'working',
        membership: 'live',
        firstObservedAt: 100,
        observedAt: 1_000,
        stoppable: true,
        invocation: { invocationId: 'child-1', generation: 1 },
        ...changes
      }
    ],
    FRESH
  )
  return row
}

function renderControl(
  row: AgentChildRowModel,
  props: {
    supportsTaskStop: boolean | undefined
    stoppingTaskIds?: ReadonlySet<string>
    onStop?: (taskId: string) => void
  }
) {
  const onStop = props.onStop ?? vi.fn()
  render(
    <TooltipProvider>
      <NativeChatBackgroundTaskStopControl
        row={row}
        stop={{
          supportsTaskStop: props.supportsTaskStop,
          stoppingTaskIds: props.stoppingTaskIds ?? new Set(),
          onStop
        }}
      />
    </TooltipProvider>
  )
  return { onStop }
}

describe('NativeChatBackgroundTaskStopControl', () => {
  it('stops the task it names, by its provider id, when the host can stop it', () => {
    const { onStop } = renderControl(liveRow(), { supportsTaskStop: true })
    const stop = screen.getByRole('button', { name: 'Stop sleep 90' })

    expect(stop).toBeEnabled()
    fireEvent.click(stop)
    expect(onStop).toHaveBeenCalledWith('provider-1')
  })

  it('disables the Stop while the host is still stopping that task', () => {
    renderControl(liveRow(), { supportsTaskStop: true, stoppingTaskIds: new Set(['provider-1']) })
    expect(screen.getByRole('button', { name: 'Stop sleep 90' })).toBeDisabled()
  })

  it('shows a provider that cannot stop as a disabled Stop that says why', () => {
    const { onStop } = renderControl(liveRow(), { supportsTaskStop: false })
    const stop = screen.getByRole('button', { name: 'Stop sleep 90' })

    expect(stop).toBeDisabled()
    expect(stop).toHaveAttribute('aria-description', 'This provider cannot stop background tasks.')
    fireEvent.click(stop)
    expect(onStop).not.toHaveBeenCalled()
  })

  it('shows a task the host cannot target as a disabled Stop with its own reason', () => {
    const { onStop } = renderControl(liveRow({ stoppable: false }), { supportsTaskStop: true })
    const stop = screen.getByRole('button', { name: 'Stop sleep 90' })

    expect(stop).toBeDisabled()
    expect(stop).toHaveAttribute('aria-description', 'This task cannot be stopped on its own.')
    fireEvent.click(stop)
    expect(onStop).not.toHaveBeenCalled()
  })

  it('draws no Stop from a host that predates the field', () => {
    renderControl(liveRow(), { supportsTaskStop: undefined })
    expect(screen.queryByRole('button', { name: 'Stop sleep 90' })).not.toBeInTheDocument()
  })

  it('draws no Stop on a settled task', () => {
    renderControl(liveRow({ membership: 'settled', state: 'done', settledAt: 900 }), {
      supportsTaskStop: true
    })
    expect(screen.queryByRole('button', { name: 'Stop sleep 90' })).not.toBeInTheDocument()
  })
})
