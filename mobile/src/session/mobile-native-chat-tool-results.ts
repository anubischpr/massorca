import type { NativeChatMessage } from '../../../src/shared/native-chat-types'

export type MobileNativeChatToolResult = { output: string; isError: boolean }

/** The main conversation's tool results keyed by the call each answers. Subagent rows are skipped. */
export function mobileNativeChatToolResults(
  messages: readonly NativeChatMessage[]
): ReadonlyMap<string, MobileNativeChatToolResult> {
  const results = new Map<string, MobileNativeChatToolResult>()
  for (const message of messages) {
    if (message.agentId !== undefined) {
      continue
    }
    for (const block of message.blocks) {
      if (block.type === 'tool-result' && block.callId !== undefined) {
        results.set(block.callId, { output: block.output, isError: block.isError === true })
      }
    }
  }
  return results
}
