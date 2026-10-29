import { editFilesFromToolPair } from '../../../src/shared/native-chat-edit-normalize'
import { editedPathsFromToolPair } from '../../../src/shared/native-chat-edit-paths'
import { toolFilePath } from '../../../src/shared/native-chat-tool-summary'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import { isPrototypeArtifactPath } from '../../../src/shared/prototype-artifact-paths'
import { mobileNativeChatToolResults } from './mobile-native-chat-tool-results'

/** One file the main agent's landed tool calls changed. */
export type MobileNativeChatRecordedFile = {
  path: string
  /** Epoch ms of the latest landed write, or null when the transcript carried no timestamp. */
  timestamp: number | null
  /** Lines added, summed over every landed edit that reported a diff; null when none did. */
  added: number | null
  /** Lines removed, summed the same way as `added`. */
  removed: number | null
}

/** Distinct files the main agent's landed tool calls changed, in the order they were first written.
 *  Mobile keys a file by the path the call reported, so one file named two ways counts twice. */
export function mobileNativeChatRecordedFiles(
  messages: readonly NativeChatMessage[]
): MobileNativeChatRecordedFile[] {
  const results = mobileNativeChatToolResults(messages)
  const files = new Map<string, MobileNativeChatRecordedFile>()
  for (const message of messages) {
    if (message.agentId !== undefined) {
      continue
    }
    for (const block of message.blocks) {
      if (block.type !== 'tool-call') {
        continue
      }
      const result = block.callId === undefined ? undefined : results.get(block.callId)
      const pair = {
        name: block.name,
        input: block.input,
        state: block.state,
        ...(result ? { result: { output: result.output, isError: result.isError } } : {})
      }
      const diffs = editFilesFromToolPair(pair)
      for (const path of editedPathsFromToolPair(pair)) {
        if (path === 'file' && toolFilePath(block.input) !== 'file') {
          continue
        }
        const diff = diffs?.find((file) => file.path === path)
        const previous = files.get(path)
        files.set(path, {
          path,
          timestamp: latest(previous?.timestamp ?? null, message.timestamp),
          added: sumCounts(previous?.added ?? null, diff?.added),
          removed: sumCounts(previous?.removed ?? null, diff?.removed)
        })
      }
    }
  }
  // Prototype files belong to the Prototypes view, not to Artifacts or the turn cards.
  return [...files.values()].filter((file) => !isPrototypeArtifactPath(file.path))
}

/** Distinct files the main agent's landed tool calls changed; the count the menu shows. */
export function mobileNativeChatRecordedFileCount(messages: readonly NativeChatMessage[]): number {
  return mobileNativeChatRecordedFiles(messages).length
}

function latest(a: number | null, b: number | null): number | null {
  if (a === null) {
    return b
  }
  return b === null ? a : Math.max(a, b)
}

function sumCounts(total: number | null, next: number | undefined): number | null {
  if (next === undefined) {
    return total
  }
  return (total ?? 0) + next
}
