import { afterEach, describe, expect, it } from 'vitest'
import { foldAgentLeadStatus } from '../../shared/agent-lead-status-fold'
import { createAgentChildWorkAdmission } from '../../shared/agent-status-child-work-admission'
import { agentChildWorkLiveness } from '../../shared/agent-status-child-work-liveness'
import { reconcileAgentChildWorkEvidence } from '../../shared/agent-status-child-work-reconciliation'
import { createAgentStatusStore } from '../../shared/agent-status-store'
import { makeStructuredAgentStatusSubject } from '../../shared/agent-status-subject'
import {
  closeGentleShellTurnRigs,
  openGentleShellTurnRig,
  type GentleShellTurnRig
} from './rpc-gentle-shell-test-support'

afterEach(closeGentleShellTurnRigs)

const parent = makeStructuredAgentStatusSubject(
  { executionHostId: 'local', wslDistro: null, workspaceId: 'workspace-1', workspaceKind: 'folder' },
  'session-gentle'
)

/** The row Pi's child work folds to after the lead turn settled, through the real child records. */
function settledRow(h: GentleShellTurnRig) {
  const store = createAgentStatusStore({ epoch: 'epoch-1', mode: 'authority' })
  store.applyMutation({ parent: { subject: parent } })
  let minted = 0
  const admission = createAgentChildWorkAdmission(store, { mintChildWorkId: () => `c-${++minted}` })
  let applied = 0
  return async () => {
    await h.flush()
    const evidence = h.evidence.slice(applied)
    applied = h.evidence.length
    reconcileAgentChildWorkEvidence({ store, admission, parent, provider: 'pi', evidence })
    const live = store.getChildren(parent).filter((record) => record.membership === 'live')
    return foldAgentLeadStatus({ leadState: 'done', childWorkLiveness: agentChildWorkLiveness(live) })
  }
}

const started = (id: string, tool: string, args: unknown) => ({
  type: 'tool_execution_start',
  toolCallId: id,
  toolName: tool,
  args
})
const ended = (id: string, tool: string, details: unknown) => ({
  type: 'tool_execution_end',
  toolCallId: id,
  toolName: tool,
  isError: false,
  result: { content: [{ type: 'text', text: 'ok' }], details }
})

describe('Gentle Shell session status while child work runs', () => {
  it('reads working while a background worker runs after the turn, then done when it settles', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    const row = settledRow(h)
    h.turns.receive(started('c1', 'subagent_run', { agent: 'explore', task: 't', label: 'l' }))
    h.turns.receive(
      ended('c1', 'subagent_run', {
        gentleAgents: { taskId: 't_1', agent: 'explore', status: 'running', mode: 'background' }
      })
    )
    expect(await row()).toEqual({ stateName: 'working' })
    h.turns.receive({
      type: 'message_end',
      message: {
        role: 'custom',
        customType: 'gentle-agents.result',
        content: 'Subagent explore finished.\n\nok',
        details: { gentleAgents: { taskId: 't_1', status: 'completed' } }
      }
    })
    expect(await row()).toEqual({ stateName: 'done' })
  })

  it('keeps a worker that waits on its parent working, never waiting on the user', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    const row = settledRow(h)
    h.turns.receive(started('c1', 'subagent_run', { agent: 'explore', task: 't' }))
    h.turns.receive(
      ended('c1', 'subagent_run', { gentleAgents: { taskId: 't_1', status: 'waiting' } })
    )
    expect(await row()).toEqual({ stateName: 'working' })
  })

  it('reads a background job as monitoring, the rule Claude and Codex share', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    const row = settledRow(h)
    h.turns.receive(started('j1', 'bash_background', { command: 'make', label: 'build' }))
    h.turns.receive(
      ended('j1', 'bash_background', {
        gentleJobs: { jobId: 'job-1', kind: 'command', label: 'build', status: 'running' }
      })
    )
    expect(await row()).toEqual({ stateName: 'working', workingMode: 'monitoring' })
  })
})
