import { editedPathsFromToolPair } from '../../../src/shared/native-chat-edit-paths'
import { toolFilePath } from '../../../src/shared/native-chat-tool-summary'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import { mobileNativeChatToolResults } from './mobile-native-chat-tool-results'

/** Distinct files the main agent's landed tool calls changed, read as desktop's result list reads
 *  them. Mobile keys a file by the path the call reported, so one file named two ways counts twice. */
export function mobileNativeChatRecordedFileCount(messages: readonly NativeChatMessage[]): number {
  const results = mobileNativeChatToolResults(messages)
  const paths = new Set<string>()
  for (const message of messages) {
    if (message.agentId !== undefined) {
      continue
    }
    for (const block of message.blocks) {
      if (block.type !== 'tool-call') {
        continue
      }
      const result = block.callId === undefined ? undefined : results.get(block.callId)
      const edited = editedPathsFromToolPair({
        name: block.name,
        input: block.input,
        state: block.state,
        ...(result ? { result: { output: result.output, isError: block.state === 'failed' } } : {})
      })
      for (const path of edited) {
        if (path !== 'file' || toolFilePath(block.input) === 'file') {
          paths.add(path)
        }
      }
    }
  }
  return paths.size
}
