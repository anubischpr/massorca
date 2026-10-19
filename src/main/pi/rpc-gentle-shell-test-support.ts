import { vi } from 'vitest'
import type { AgentChildWorkEvidence } from '../../shared/agent-status-child-work-evidence'
import { JsonlRpcTimelineLane } from '../jsonl-rpc/timeline-lane'
import {
  closeProviderTimelineRigs,
  openProviderTimelineRig
} from '../native-chat/agent-session-timeline/provider-timeline-assembler-test-support'
import { PiRpcTurns } from './rpc-turns'

const pending: (() => void)[] = []

export async function closeGentleShellTurnRigs(): Promise<void> {
  pending.splice(0).forEach((end) => end())
  await closeProviderTimelineRigs()
}

/** One Pi turn machine on a real timeline, collecting the child work it hands the host. */
export async function openGentleShellTurnRig(options: { acceptsAgentWake?: boolean } = {}) {
  const rig = await openProviderTimelineRig({ agent: 'pi', sessionId: 'session-gentle' })
  const failed = vi.fn()
  const lane = new JsonlRpcTimelineLane({
    sink: rig.sink,
    sessionId: 'session-gentle',
    agent: 'pi',
    generation: 'gen-1',
    namespace: 'session-gentle',
    pauseReading: vi.fn(),
    resumeReading: vi.fn(),
    onInputAccepted: vi.fn(),
    onFailed: failed
  })
  const evidence: AgentChildWorkEvidence[] = []
  const turns = new PiRpcTurns({
    lane,
    generation: 'gen-1',
    send: vi.fn(async () => {}),
    request: vi.fn(async () => ({
      sessionFile: '/host/session.jsonl',
      isStreaming: false,
      isCompacting: false,
      pendingMessageCount: 0
    })),
    settled: vi.fn(),
    failed,
    idle: vi.fn(),
    childWork: (batch) => evidence.push(...batch),
    ...options
  })
  pending.push(() => {
    turns.end()
    lane.dispose()
  })
  return {
    rig,
    turns,
    evidence,
    /** Opens a dispatched turn, so tool and message frames land inside it. */
    async openTurn() {
      await turns.submit('send-1', 100, { type: 'prompt', message: 'go' })
      turns.receive({ type: 'agent_start' })
      await lane.drained()
    },
    async flush() {
      lane.flush()
      await lane.drained()
      await Promise.resolve()
    }
  }
}

export type GentleShellTurnRig = Awaited<ReturnType<typeof openGentleShellTurnRig>>
