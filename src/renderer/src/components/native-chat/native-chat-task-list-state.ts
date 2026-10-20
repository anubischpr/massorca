import {
  normalizeNativeChatTaskList,
  type NativeChatTaskList
} from '../../../../shared/native-chat-task-list'
import {
  createNativeChatTaskLedger,
  isNativeChatTaskLedgerTool,
  nativeChatTaskLedgerList,
  observeNativeChatTaskCall,
  observeNativeChatTaskResult,
  type NativeChatTaskLedger
} from '../../../../shared/native-chat-task-ledger'
import type { NativeChatMessage } from '../../../../shared/native-chat-types'
import { pairToolBlocks } from './native-chat-tool-fold'

const snapshots = new WeakMap<NativeChatMessage, NativeChatTaskList | null>()

function latestSnapshot(message: NativeChatMessage): NativeChatTaskList | null {
  if (snapshots.has(message)) {
    return snapshots.get(message) ?? null
  }
  let list: NativeChatTaskList | null = null
  if (message.role === 'assistant') {
    for (const { call, result } of pairToolBlocks(message.blocks)) {
      if (!call || call.state === 'failed' || result?.isError) {
        continue
      }
      const snapshot = normalizeNativeChatTaskList(call.name, call.input)
      if (snapshot) {
        list = snapshot
      }
    }
  }
  snapshots.set(message, list)
  return list
}

/** Fold Claude's TaskCreate/TaskUpdate calls of one message into the running ledger. */
function observeLedgerCalls(ledger: NativeChatTaskLedger, message: NativeChatMessage): boolean {
  let changed = false
  for (const [index, { call, result }] of pairToolBlocks(message.blocks).entries()) {
    if (!call || call.state === 'failed' || !isNativeChatTaskLedgerTool(call.name)) {
      continue
    }
    const callId = call.callId ?? `${message.id}:${index}`
    observeNativeChatTaskCall(ledger, { callId, name: call.name, input: call.input })
    if (result) {
      observeNativeChatTaskResult(ledger, {
        callId,
        output: result.output,
        isError: result.isError === true
      })
    }
    changed = true
  }
  return changed
}

/** Select composer progress without consuming historical transcript updates. */
export function nativeChatTaskListState(messages: readonly NativeChatMessage[]): {
  messages: readonly NativeChatMessage[]
  list: NativeChatTaskList | null
} {
  let list: NativeChatTaskList | null = null
  const ledger = createNativeChatTaskLedger()
  for (const message of messages) {
    const snapshot = latestSnapshot(message)
    if (snapshot) {
      list = snapshot
    }
    if (message.role === 'assistant' && observeLedgerCalls(ledger, message)) {
      list = nativeChatTaskLedgerList(ledger) ?? list
    }
  }
  return { messages, list }
}
