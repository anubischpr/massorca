import { afterEach, describe, expect, it } from 'vitest'
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
})
