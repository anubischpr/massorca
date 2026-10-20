import { describe, expect, it } from 'vitest'
import {
  createNativeChatTaskLedger,
  isNativeChatTaskLedgerTool,
  nativeChatTaskLedgerList,
  observeNativeChatTaskCall,
  observeNativeChatTaskResult
} from './native-chat-task-ledger'

function create(
  ledger: ReturnType<typeof createNativeChatTaskLedger>,
  callId: string,
  input: unknown
) {
  observeNativeChatTaskCall(ledger, { callId, name: 'TaskCreate', input })
}
function created(
  ledger: ReturnType<typeof createNativeChatTaskLedger>,
  callId: string,
  id: string
) {
  observeNativeChatTaskResult(ledger, {
    callId,
    output: `Task #${id} created successfully: x`,
    isError: false
  })
}

describe('native chat task ledger', () => {
  it('names only the incremental task tools', () => {
    expect(['TaskCreate', 'taskupdate'].map(isNativeChatTaskLedgerTool)).toEqual([true, true])
    expect(['TaskList', 'TodoWrite', 'Task'].map(isNativeChatTaskLedgerTool)).toEqual([
      false,
      false,
      false
    ])
  })

  it('shows a create as pending before its id is known, then keeps it under that id', () => {
    const ledger = createNativeChatTaskLedger()
    expect(nativeChatTaskLedgerList(ledger)).toBeNull()
    create(ledger, 'a', {
      subject: 'Read',
      description: 'd',
      activeForm: 'Reading'
    })
    expect(nativeChatTaskLedgerList(ledger)?.tasks).toEqual([
      { content: 'Read', status: 'pending', activeForm: 'Reading' }
    ])
    created(ledger, 'a', '1')
    observeNativeChatTaskCall(ledger, {
      callId: 'u',
      name: 'TaskUpdate',
      input: { taskId: '1', status: 'in_progress' }
    })
    expect(nativeChatTaskLedgerList(ledger)?.tasks).toEqual([
      { content: 'Read', status: 'in_progress', activeForm: 'Reading' }
    ])
  })

  it('patches by id, keeps creation order and drops deleted or failed creates', () => {
    const ledger = createNativeChatTaskLedger()
    for (const [callId, id, subject] of [
      ['a', '1', 'One'],
      ['b', '2', 'Two'],
      ['c', '3', 'Three']
    ]) {
      create(ledger, callId, { subject })
      created(ledger, callId, id)
    }
    create(ledger, 'bad', { subject: 'Nope' })
    observeNativeChatTaskResult(ledger, {
      callId: 'bad',
      output: 'err',
      isError: true
    })
    observeNativeChatTaskCall(ledger, {
      callId: 'u1',
      name: 'TaskUpdate',
      input: { taskId: '2', status: 'completed' }
    })
    observeNativeChatTaskCall(ledger, {
      callId: 'u2',
      name: 'TaskUpdate',
      input: { taskId: '1', subject: 'Uno' }
    })
    observeNativeChatTaskCall(ledger, {
      callId: 'u3',
      name: 'TaskUpdate',
      input: '{"task_id":"3","status":"deleted"}'
    })
    expect(nativeChatTaskLedgerList(ledger)?.tasks).toEqual([
      { content: 'Uno', status: 'pending' },
      { content: 'Two', status: 'completed' }
    ])
  })
})
