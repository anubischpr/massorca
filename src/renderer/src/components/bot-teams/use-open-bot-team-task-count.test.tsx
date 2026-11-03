/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionStatusSummary } from '../../../../shared/agent-session-wire'
import { UNREPORTED_SESSION_GRACE_MS } from './open-bot-team-task-count'
import { useOpenBotTeamTaskCount } from './use-open-bot-team-task-count'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

type Summary = Pick<AgentSessionStatusSummary, 'status' | 'turnOutcome'>

let latest: number | null = null

function Probe({
  tasks,
  statuses
}: {
  tasks: { sessionId: string | null }[]
  statuses: ReadonlyMap<string, Summary>
}): null {
  latest = useOpenBotTeamTaskCount(tasks, statuses)
  return null
}

const mounted: { container: HTMLDivElement; root: Root }[] = []

/** Mounts the probe once, then re-renders the same root with new props. */
function renderProbe(
  root: Root | null,
  tasks: { sessionId: string | null }[],
  statuses: ReadonlyMap<string, Summary>
): Root {
  if (root !== null) {
    act(() => root.render(<Probe tasks={tasks} statuses={statuses} />))
    return root
  }
  const container = document.createElement('div')
  document.body.append(container)
  const created = createRoot(container)
  mounted.push({ container, root: created })
  act(() => created.render(<Probe tasks={tasks} statuses={statuses} />))
  return created
}

beforeEach(() => {
  vi.useFakeTimers()
  latest = null
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.useRealTimers()
})

describe('the open count of a team room while a session is unreported', () => {
  it('hides the count until the grace period passes, then counts the session as open', () => {
    const root = renderProbe(null, [{ sessionId: 's1' }], new Map())
    expect(latest).toBeNull()

    act(() => vi.advanceTimersByTime(UNREPORTED_SESSION_GRACE_MS - 1))
    expect(latest).toBeNull()

    act(() => vi.advanceTimersByTime(1))
    expect(latest).toBe(1)
    expect(root).toBeDefined()
  })

  it('takes the session from the feed as soon as it reports, and counts it Done when finished', () => {
    const root = renderProbe(null, [{ sessionId: 's1' }], new Map())
    renderProbe(root, [{ sessionId: 's1' }], new Map<string, Summary>([['s1', { status: 'idle' }]]))

    expect(latest).toBe(0)
  })

  it('shows a count at once when every started task is already reported', () => {
    renderProbe(
      null,
      [{ sessionId: 's1' }, { sessionId: null }],
      new Map<string, Summary>([['s1', { status: 'attention' }]])
    )

    expect(latest).toBe(2)
  })
})
