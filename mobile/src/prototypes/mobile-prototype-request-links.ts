import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import { prototypeTitle } from '../../../src/shared/prototype-list-model'
import { splitPrototypeHiddenInstruction } from '../../../src/shared/prototype-hidden-instruction'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'

function userText(message: NativeChatMessage): string {
  const text = message.blocks.map((block) => (block.type === 'text' ? block.text : '')).join('')
  return splitPrototypeHiddenInstruction(text).visibleText.replace(/\s+/gu, ' ').trim()
}

/**
 * The set each prototype request opened, keyed by the user turn that asked for it: the oldest set
 * takes the oldest turn that reads as its prompt, so two requests with the same words each find
 * their own turn. A set of another chat, or whose turn is not in the transcript, links nowhere.
 */
export function matchPrototypeSetsToUserTurns(
  sets: readonly PrototypeListedSet[],
  messages: readonly NativeChatMessage[],
  sessionId: string
): Map<string, PrototypeListedSet> {
  const matched = new Map<string, PrototypeListedSet>()
  const ofChat = sets
    .filter((set) => set.sessionId === sessionId)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
  for (const set of ofChat) {
    const prompt = set.originalPrompt.replace(/\s+/gu, ' ').trim()
    const turn = messages.find(
      (message) =>
        message.role === 'user' && !matched.has(message.id) && userText(message) === prompt
    )
    if (turn !== undefined) {
      matched.set(turn.id, set)
    }
  }
  return matched
}

/** The link card's words: the request's first words, and how many directions it asked for. */
export function prototypeRequestLinkLabel(
  set: Pick<PrototypeListedSet, 'originalPrompt' | 'count'>
): string {
  return `${prototypeTitle({ chatTitle: null, originalPrompt: set.originalPrompt })} · set of ${set.count}`
}
