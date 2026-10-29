// The chat shows what the user wrote, never the instruction MassOrca hid behind it.
import { splitPrototypeHiddenInstruction } from './prototype-hidden-instruction'
import type { NativeChatBlock } from './native-chat-types'

/** The blocks without a hidden prototype instruction; the same array when there is none. */
export function withoutPrototypeHiddenInstruction(blocks: NativeChatBlock[]): NativeChatBlock[] {
  let changed = false
  const visible = blocks.flatMap((block): NativeChatBlock[] => {
    if (block.type !== 'text') {
      return [block]
    }
    const split = splitPrototypeHiddenInstruction(block.text)
    if (split.hidden === undefined) {
      return [block]
    }
    changed = true
    return split.visibleText === '' ? [] : [{ ...block, text: split.visibleText }]
  })
  return changed ? visible : blocks
}

/** The request a message opened, when its text carries a request marker; an iteration is not one. */
export function prototypeRequestIdOfBlocks(blocks: readonly NativeChatBlock[]): string | undefined {
  for (const block of blocks) {
    if (block.type !== 'text') {
      continue
    }
    const { hidden } = splitPrototypeHiddenInstruction(block.text)
    if (hidden?.kind === 'request') {
      return hidden.requestId
    }
  }
  return undefined
}
