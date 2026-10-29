import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import { protectMobileMarkdownVisualLines } from '../components/mobile-markdown-visual-lines'

/** A visual the chat's assistant replies showed with a `::orca-visual` line. */
export type MobileNativeChatVisualPage = {
  /** The visuals-folder file name, as the directive names it. */
  file: string
  title: string | null
  /** Epoch ms of the latest reply that showed it, or null when the transcript carried no time. */
  timestamp: number | null
}

/** The visuals the main agent's replies showed, one per file, in the order they were first shown. */
export function mobileNativeChatVisualPages(
  messages: readonly NativeChatMessage[]
): MobileNativeChatVisualPage[] {
  const pages = new Map<string, MobileNativeChatVisualPage>()
  for (const message of messages) {
    if (message.role !== 'assistant' || message.agentId !== undefined) {
      continue
    }
    for (const block of message.blocks) {
      if (block.type !== 'text') {
        continue
      }
      for (const directive of protectMobileMarkdownVisualLines(block.text).directives) {
        const previous = pages.get(directive.file)
        pages.set(directive.file, {
          file: directive.file,
          title: directive.title ?? previous?.title ?? null,
          timestamp: latest(previous?.timestamp ?? null, message.timestamp)
        })
      }
    }
  }
  return [...pages.values()]
}

function latest(a: number | null, b: number | null): number | null {
  if (a === null) {
    return b
  }
  return b === null ? a : Math.max(a, b)
}
