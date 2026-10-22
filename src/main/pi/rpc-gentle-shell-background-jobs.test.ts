import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentChildWorkEvidence } from '../../shared/agent-status-child-work-evidence'
import { PiRpcBackgroundJobs } from './rpc-background-jobs'
import {
  closeGentleShellTurnRigs,
  openGentleShellTurnRig,
  type GentleShellTurnRig
} from './rpc-gentle-shell-test-support'

afterEach(closeGentleShellTurnRigs)

const startResult = (jobId: string, kind: 'command' | 'monitor', label: string) => ({
  content: [{ type: 'text', text: `Started background job ${jobId}` }],
  details: {
    gentleJobs: { jobId, kind, label, status: 'running', exitCode: null, outputPath: '/tmp/x.log' }
  }
})

function startJob(
  h: GentleShellTurnRig,
  callId: string,
  tool: 'bash_background' | 'monitor',
  jobId: string,
  command: string,
  label: string
) {
  h.turns.receive({
    type: 'tool_execution_start',
    toolCallId: callId,
    toolName: tool,
    args: { command, label }
  })
  h.turns.receive({
    type: 'tool_execution_end',
    toolCallId: callId,
    toolName: tool,
    isError: false,
    result: startResult(jobId, tool === 'monitor' ? 'monitor' : 'command', label)
  })
}

const notice = (content: string, gentleJobs: Record<string, unknown>) => ({
  type: 'message_end',
  message: {
    role: 'custom',
    customType: 'gentle-jobs.notice',
    content,
    display: true,
    details: { gentleJobs }
  }
})

describe('Gentle Shell background jobs', () => {
  it('lists a started job as live background work with its command and label', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    startJob(h, 'c1', 'bash_background', 'job-1', 'pnpm test', 'full suite')
    await h.flush()
    expect(h.evidence).toEqual([
      {
        type: 'live',
        observedAt: expect.any(Number),
        child: {
          handle: { idKind: 'task_id', id: 'gentle-job:gen-1:job-1', runId: 'c1' },
          kind: 'command',
          residency: 'background',
          state: 'working',
          name: 'full suite',
          description: 'pnpm test',
          stoppable: false
        }
      }
    ])
  })

  it('settles the job from its own exit notice with the outcome and output tail', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    startJob(h, 'c1', 'bash_background', 'job-1', 'pnpm test', 'full suite')
    startJob(h, 'c2', 'bash_background', 'job-2', 'make deploy', 'deploy')
    h.turns.receive(
      notice(
        'Background job job-1 ("full suite") exited with code 0 after 5s.\nCommand: pnpm test\nLast output:\n..... [68%]\n12 passed\nFull output: /tmp/x.log (read it)',
        { jobId: 'job-1', kind: 'command', label: 'full suite', status: 'exited', exitCode: 0 }
      )
    )
    h.turns.receive(
      notice(
        'Background job job-2 ("deploy") exited with code 2 after 1s.\nCommand: make deploy\nNo output.\nFull output: /tmp/y.log (read it)',
        { jobId: 'job-2', kind: 'command', label: 'deploy', status: 'exited', exitCode: 2 }
      )
    )
    await h.flush()
    const ended = h.evidence.flatMap((edge) => (edge.type === 'ended' ? [edge] : []))
    expect(ended).toEqual([
      {
        type: 'ended',
        observedAt: expect.any(Number),
        handle: { idKind: 'task_id', id: 'gentle-job:gen-1:job-1', runId: 'c1' },
        outcome: 'succeeded',
        lastMessage: '..... [68%] ⏎ 12 passed'
      },
      {
        type: 'ended',
        observedAt: expect.any(Number),
        handle: { idKind: 'task_id', id: 'gentle-job:gen-1:job-2', runId: 'c2' },
        outcome: 'failed'
      }
    ])
  })

  it('reports each monitor event batch as the newest output, then its stop', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    startJob(h, 'm1', 'monitor', 'job-1', 'tail -f app.log', 'errors')
    h.turns.receive(
      notice('Monitor job-1 ("errors") reported 2 new lines:\nERROR a\nERROR b', {
        jobId: 'job-1',
        kind: 'monitor',
        status: 'running',
        event: 'events'
      })
    )
    h.turns.receive(
      notice('Monitor job-1 ("errors") reached its 60s timeout after 2 events and was stopped.', {
        jobId: 'job-1',
        kind: 'monitor',
        status: 'running',
        event: 'timeout'
      })
    )
    await h.flush()
    expect(h.evidence.map((edge) => edge.type)).toEqual(['live', 'live', 'ended'])
    expect(h.evidence[0]).toMatchObject({ child: { kind: 'monitor' } })
    expect(h.evidence[1]).toMatchObject({ child: { lastMessage: 'ERROR a ⏎ ERROR b' } })
    expect(h.evidence[2]).toMatchObject({ outcome: 'cancelled' })
  })

  it('settles a job the model stopped, ignores unknown jobs and ends everything with the session', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    startJob(h, 'c1', 'bash_background', 'job-1', 'sleep 900', 'sleeper')
    startJob(h, 'c2', 'bash_background', 'job-2', 'sleep 900', 'second')
    h.turns.receive({
      type: 'tool_execution_end',
      toolCallId: 's1',
      toolName: 'job_stop',
      isError: false,
      result: {
        content: [{ type: 'text', text: 'Stopped job-1' }],
        details: { gentleJobs: { jobId: 'job-1', kind: 'command', status: 'stopped' } }
      }
    })
    h.turns.receive(
      notice('Background job job-9 ("ghost") exited with code 0.', {
        jobId: 'job-9',
        kind: 'command',
        status: 'exited',
        exitCode: 0
      })
    )
    h.turns.end()
    await h.flush()
    expect(h.evidence.map((edge) => edge.type)).toEqual(['live', 'live', 'ended', 'session-ended'])
    expect(h.evidence[2]).toMatchObject({ outcome: 'cancelled' })
  })

  it('publishes nothing for ordinary tools', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    h.turns.receive({
      type: 'tool_execution_end',
      toolCallId: 'b1',
      toolName: 'bash',
      isError: false,
      result: { content: [{ type: 'text', text: 'ok' }] }
    })
    await h.flush()
    expect(h.evidence).toEqual([])
  })
})

describe('an agent run Gentle Shell starts itself', () => {
  it('is a normal wake-up on Gentle Shell and a protocol violation on stock Pi', async () => {
    const gentle = await openGentleShellTurnRig({ acceptsAgentWake: true })
    expect(() => gentle.turns.receive({ type: 'agent_start' })).not.toThrow()
    const stock = await openGentleShellTurnRig()
    expect(() => stock.turns.receive({ type: 'agent_start' })).toThrow('unsolicited agent run')
  })

  it('journals the wake-up as an agent turn with no user message, then settles it', async () => {
    const h = await openGentleShellTurnRig({ acceptsAgentWake: true })
    h.turns.receive({ type: 'agent_start' })
    h.turns.receive({ type: 'message_start', message: { role: 'assistant', content: [] } })
    h.turns.receive({
      type: 'message_end',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'The suite passed: 12 tests.' }],
        stopReason: 'stop'
      }
    })
    h.turns.receive({ type: 'agent_end' })
    h.turns.receive({ type: 'agent_settled' })
    await vi.waitFor(async () => expect((await h.rig.turns())[0]?.outcome).toBe('success'))
    const rows = await h.rig.rows()
    expect(rows.some(({ body }) => body.kind === 'message' && body.role === 'user')).toBe(false)
    expect(rows.some(({ body }) => body.kind === 'message' && body.role === 'assistant')).toBe(true)
  })

  it('ends a live job as unknown when its exit notice carries a status this build does not know', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    startJob(h, 'c1', 'bash_background', 'job-1', 'sleep 900', 'sleeper')
    h.turns.receive(
      notice('Background job job-1 ("sleeper") ended.', {
        jobId: 'job-1',
        kind: 'command',
        status: 'vanished'
      })
    )
    await h.flush()
    expect(h.evidence.map((edge) => edge.type)).toEqual(['live', 'ended'])
    expect(h.evidence[1]).toMatchObject({ outcome: 'unknown' })
  })

  it('keeps a job live through a notice of a kind this build does not know', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    startJob(h, 'c1', 'bash_background', 'job-1', 'sleep 900', 'sleeper')
    h.turns.receive(
      notice('Background job job-1 reported something new.', {
        jobId: 'job-1',
        status: 'vanished',
        event: 'novel'
      })
    )
    await h.flush()
    expect(h.evidence.map((edge) => edge.type)).toEqual(['live'])
  })
})

describe('Gentle Shell background job publishing', () => {
  const start = (jobs: PiRpcBackgroundJobs, id: string) => {
    jobs.observeFrame({
      type: 'tool_execution_start',
      toolCallId: id,
      toolName: 'bash_background',
      args: { command: `run ${id}`, label: id }
    })
    jobs.observeFrame({
      type: 'tool_execution_end',
      toolCallId: id,
      toolName: 'bash_background',
      isError: false,
      result: startResult(id, 'command', id)
    })
  }

  it('reports a failed drain once and still delivers the batches after it', async () => {
    const delivered: AgentChildWorkEvidence[][] = []
    const diagnostic = vi.fn()
    const drained = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('drain failed'))
      .mockResolvedValue(undefined)
    const jobs = new PiRpcBackgroundJobs({
      generation: 'gen-1',
      drained,
      deliver: (batch) => delivered.push(batch),
      diagnostic
    })
    start(jobs, 'job-1')
    start(jobs, 'job-2')
    await vi.waitFor(() => expect(delivered.length).toBeGreaterThan(0))
    expect(diagnostic).toHaveBeenCalledTimes(1)
  })

  it('waits for one batch to deliver before it asks the journal about the next', async () => {
    const delivered: string[] = []
    const releases: (() => void)[] = []
    const jobs = new PiRpcBackgroundJobs({
      generation: 'gen-1',
      drained: () => new Promise<void>((resolve) => releases.push(resolve)),
      deliver: (batch) => delivered.push(...batch.map((edge) => edge.type))
    })
    start(jobs, 'job-1')
    jobs.observeFrame(
      notice('Background job job-1 exited with code 0.', {
        jobId: 'job-1',
        kind: 'command',
        status: 'exited',
        exitCode: 0
      })
    )
    await vi.waitFor(() => expect(releases).toHaveLength(1))
    expect(delivered).toEqual([])
    releases[0]?.()
    await vi.waitFor(() => expect(releases).toHaveLength(2))
    expect(delivered).toEqual(['live'])
    releases[1]?.()
    await vi.waitFor(() => expect(delivered).toEqual(['live', 'ended']))
  })

  it('stops tracking past 64 live jobs and ignores the exit of one it dropped', async () => {
    const delivered: AgentChildWorkEvidence[] = []
    const jobs = new PiRpcBackgroundJobs({
      generation: 'gen-1',
      drained: async () => {},
      deliver: (batch) => delivered.push(...batch)
    })
    for (let index = 0; index < 65; index += 1) {
      start(jobs, `job-${index}`)
    }
    jobs.observeFrame(
      notice('Background job job-64 exited with code 0.', {
        jobId: 'job-64',
        kind: 'command',
        status: 'exited',
        exitCode: 0
      })
    )
    await vi.waitFor(() =>
      expect(delivered.filter((edge) => edge.type === 'live')).toHaveLength(64)
    )
    expect(delivered.some((edge) => edge.type === 'ended')).toBe(false)
  })
})
