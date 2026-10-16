// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NativeChatSessionSummary } from './NativeChatSessionSummary'
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) => selector({ worktreesByRepo: {} })
}))
vi.mock('./use-structured-agent-session-host-label', () => ({
  useStructuredAgentSessionHostLabel: () => 'Development VPS'
}))
vi.mock('./NativeChatSessionServers', () => ({
  NativeChatSessionServers: () => <div>QA servers</div>
}))
vi.mock('./NativeChatCodexBackgroundPanel', () => ({ NativeChatCodexBackgroundPanel: () => null }))
afterEach(cleanup)
const props = {
  target: { kind: 'environment', environmentId: 'opaque-id' } as const,
  fileContext: null,
  contextUsage: null,
  roster: undefined,
  isVisible: true,
  onLinkClick: undefined,
  journalItems: [
    {
      itemId: 'call',
      sequence: 1,
      revision: 1,
      observedAt: 10,
      body: { kind: 'tool-call', name: 'mcp__history__search', input: {}, state: 'completed' }
    }
  ] as const
}
it('keeps historical success separate from unknown current connector status', () => {
  render(<NativeChatSessionSummary {...props} />)
  expect(screen.getByText('Development VPS')).toBeTruthy()
  expect(screen.queryByText('opaque-id')).toBeNull()
  expect(
    screen.getByText('Current connector status is not reported by this provider or host.')
  ).toBeTruthy()
  expect(screen.queryByText(/connected/i)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Connectors/ }))
  expect(screen.getByText('Recorded calls (historical)')).toBeTruthy()
  expect(screen.getByText('completed')).toBeTruthy()
})
it('shows provider connection states in compact cards and suppresses disconnected transport claims', () => {
  const connectorSnapshot = {
    observedAt: 10,
    servers: [
      { name: 'docs', status: 'connected' as const },
      { name: 'broken', status: 'failed' as const }
    ]
  }
  const { rerender } = render(
    <NativeChatSessionSummary {...props} connectorSnapshot={connectorSnapshot} />
  )
  expect(screen.getByText('docs · Connected')).toBeTruthy()
  expect(screen.getByText('broken · Failed')).toBeTruthy()
  expect(screen.getByText(/Provider status at/)).toBeTruthy()
  rerender(
    <NativeChatSessionSummary
      {...props}
      connectorSnapshot={connectorSnapshot}
      context={{
        parentEvidenceFresh: false,
        transportObservation: 'unverifiable',
        parentObservedAt: 10,
        hostClockOffsetMs: 0
      }}
    />
  )
  expect(screen.queryByText('docs · Connected')).toBeNull()
  expect(
    screen.getByText('Current connector status is not reported by this provider or host.')
  ).toBeTruthy()
})
it('distinguishes a confirmed empty connector inventory from unavailable data', () => {
  render(
    <NativeChatSessionSummary {...props} connectorSnapshot={{ observedAt: 10, servers: [] }} />
  )
  expect(
    screen.queryByText('Current connector status is not reported by this provider or host.')
  ).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Subagents/ }))
  expect(
    screen.getByText('Subagent information is not reported by this provider or host.')
  ).toBeTruthy()
})

it('uses bounded context percentages in the compact card and expanded detail', () => {
  const contextUsage = {
    usedTokens: 27_539,
    windowTokens: 1_000_000,
    percentage: 2.7539000000000002,
    estimated: false,
    categories: []
  }
  render(<NativeChatSessionSummary {...props} contextUsage={contextUsage} />)
  expect(screen.getByText('2.8%')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Context/ }))
  expect(screen.getByText(/2\.8% ·/)).toBeTruthy()
  expect(screen.queryByText(/2\.7539000000000002/)).toBeNull()
  expect(contextUsage.percentage).toBe(2.7539000000000002)
})
