import { describe, expect, it } from 'vitest'
import capture from './codex-subagent-command-capture.fixture.json'
import { CodexBackgroundTaskTracker } from './codex-background-task-tracker'
import type { CodexBackgroundTaskEvent } from './codex-background-task-frames'

// Trimmed from a real `codex app-server` 0.159.2 run: the parent waits on a spawned subagent
// whose own turn runs one unified-exec command (two empty polls, then exit 0).
const PARENT = '01a18399-b785-77c0-b623-652af2ab5bf0'
const CHILD = '01a1839a-5d72-7e30-9e46-833110ceae9b'
const COMMAND_TASK_ID = `codex-command:thread:${CHILD}:exec-c9f59e0f-25f4-4f8a-a612-cbbd1eabe1b9`

function replay(upTo: (method: string, event: CodexBackgroundTaskEvent) => boolean) {
  const tracker = new CodexBackgroundTaskTracker(PARENT)
  const evidence: ReturnType<CodexBackgroundTaskTracker['drainChildWorkEvidence']> = []
  const seen: string[] = []
  for (const frame of capture) {
    const event: CodexBackgroundTaskEvent = {
      method: frame.method,
      threadId: frame.threadId,
      params: frame.params
    }
    if (upTo(frame.method, event)) {
      break
    }
    expect(tracker.canObserve(event)).toBe(true)
    tracker.observe(event)
    evidence.push(...tracker.drainChildWorkEvidence(1))
    seen.push(frame.method)
  }
  return { tracker, evidence }
}

const kinds = (tracker: CodexBackgroundTaskTracker) =>
  (tracker.state?.tasks ?? []).map((task) => task.kind).sort()

describe('Codex subagent command from a captured run', () => {
  it('publishes the child command beside its agent row while the child turn works', () => {
    const { tracker, evidence } = replay((method, event) => {
      return method === 'item/completed' && event.threadId === CHILD
    })
    expect(kinds(tracker)).toEqual(['agent', 'command'])
    expect((tracker.state?.tasks ?? []).find((task) => task.kind === 'command')).toMatchObject({
      id: COMMAND_TASK_ID,
      description: expect.stringContaining('ping -n 40')
    })
    const live = evidence.find((entry) => entry.type === 'live' && entry.child.kind === 'command')
    expect(live).toMatchObject({
      child: { residency: 'background', state: 'working', ownerId: CHILD }
    })
  })

  it('settles the command on exit without leaving a row behind', () => {
    const { tracker, evidence } = replay(() => false)
    expect(tracker.state).toBeNull()
    expect(
      evidence.some(
        (entry) =>
          entry.type === 'ended' &&
          entry.handle.id === COMMAND_TASK_ID &&
          entry.outcome === 'succeeded'
      )
    ).toBe(true)
  })
})
