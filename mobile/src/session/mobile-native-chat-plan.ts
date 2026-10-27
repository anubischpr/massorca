import { CODEX_PLAN_UPDATED_FRAME_KIND } from '../../../src/shared/native-chat-provider-frame-summary'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import {
  normalizeNativeChatTaskList,
  type NativeChatTaskList
} from '../../../src/shared/native-chat-task-list'
import {
  createNativeChatTaskLedger,
  isNativeChatTaskLedgerTool,
  nativeChatTaskLedgerList,
  observeNativeChatTaskCall,
  observeNativeChatTaskResult
} from '../../../src/shared/native-chat-task-ledger'
import { mobileNativeChatToolResults } from './mobile-native-chat-tool-results'

/** The main agent's plan as last reported, read the way desktop's nativeChatSessionPlan reads its
 *  journal: a TodoWrite or update_plan call, a Codex plan notification, or the list Claude's
 *  TaskCreate/TaskUpdate calls build up. Subagent rows and failed calls never replace it. */
export function mobileNativeChatPlan(
  messages: readonly NativeChatMessage[]
): NativeChatTaskList | null {
  const results = mobileNativeChatToolResults(messages)
  const ledger = createNativeChatTaskLedger()
  let plan: NativeChatTaskList | null = null
  let position = 0
  for (const message of messages) {
    if (message.agentId !== undefined) {
      continue
    }
    for (const block of message.blocks) {
      position += 1
      if (block.type === 'tool-call') {
        const callId = block.callId ?? `item:${position}`
        if (isNativeChatTaskLedgerTool(block.name)) {
          if (block.state !== 'failed') {
            const result = block.callId === undefined ? undefined : results.get(block.callId)
            observeNativeChatTaskCall(ledger, { callId, name: block.name, input: block.input })
            observeNativeChatTaskResult(ledger, {
              callId,
              output: result?.output ?? '',
              isError: false
            })
          }
          plan = nativeChatTaskLedgerList(ledger) ?? plan
        } else if (block.state !== 'failed') {
          plan = normalizeNativeChatTaskList(block.name, block.input) ?? plan
        }
        continue
      }
      const frame = block.type === 'text' ? block.providerFrame : undefined
      if (
        frame?.provider === 'codex' &&
        frame.kind === CODEX_PLAN_UPDATED_FRAME_KIND &&
        !frame.payload.truncated
      ) {
        plan = normalizeNativeChatTaskList('update_plan', frame.payload.head) ?? plan
      }
    }
  }
  return plan
}

/** Completed steps against all steps, for the plan's progress bar and menu hint. */
export function mobileNativeChatPlanProgress(plan: NativeChatTaskList): {
  done: number
  total: number
} {
  return {
    done: plan.tasks.filter((task) => task.status === 'completed').length,
    total: plan.tasks.length
  }
}
