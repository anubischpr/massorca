import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import { chatArtifactPages, type MobileArtifactPage } from './mobile-chat-artifacts-model'
import { mobileNativeChatVisualPages } from './mobile-chat-visual-pages'
import { mobileNativeChatRecordedFiles } from './mobile-native-chat-recorded-files'

/** The messages from one user prompt up to the next, which is one turn of the agent. */
function turnsOf(messages: readonly NativeChatMessage[]): NativeChatMessage[][] {
  const turns: NativeChatMessage[][] = []
  let current: NativeChatMessage[] = []
  for (const message of messages) {
    if (message.role === 'user') {
      if (current.length > 0) {
        turns.push(current)
      }
      current = []
      continue
    }
    current.push(message)
  }
  if (current.length > 0) {
    turns.push(current)
  }
  return turns
}

/**
 * The HTML pages and visuals each turn produced, keyed by the id of the turn's last message: the
 * inline artifact card sits after it. Markdown and source files are not cards; they stay in
 * Artifacts.
 */
export function mobileChatTurnArtifactCards(
  messages: readonly NativeChatMessage[]
): ReadonlyMap<string, MobileArtifactPage[]> {
  const cards = new Map<string, MobileArtifactPage[]>()
  for (const turn of turnsOf(messages)) {
    const pages = chatArtifactPages(
      mobileNativeChatRecordedFiles(turn),
      mobileNativeChatVisualPages(turn)
    ).filter((page) => page.kind === 'html')
    const last = turn.at(-1)
    if (pages.length > 0 && last) {
      cards.set(last.id, pages)
    }
  }
  return cards
}
