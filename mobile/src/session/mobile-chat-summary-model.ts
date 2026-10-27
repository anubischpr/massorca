import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import {
  mobileNativeChatRecordedFiles,
  type MobileNativeChatRecordedFile
} from './mobile-native-chat-recorded-files'

/** Thumbnails the Summary's results strip shows before "See all". */
export const SUMMARY_RESULT_PREVIEW_COUNT = 6

/** `mcp__<server>__<tool>`; a server name may hold a single underscore. */
const CONNECTOR_TOOL_NAME = /^mcp__(.+?)__/

export type MobileChatConnector = { id: string; label: string }
export type MobileChatSubagent = { id: string; label: string }

export type MobileChatSummaryModel = {
  /** The chat's first prompt, trimmed to one line, or null when there is none yet. */
  title: string | null
  /** The model that answered last, as the provider names it. */
  model: string | null
  connectors: MobileChatConnector[]
  runningSubagents: MobileChatSubagent[]
  results: {
    total: number
    preview: MobileNativeChatRecordedFile[]
  }
}

/** `m:ss` under an hour, `h:mm:ss` from there. A clock that reads before its start reads zero. */
export function formatWorkingElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const ss = String(seconds).padStart(2, '0')
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`
  }
  return `${minutes}:${ss}`
}

/** The status line's words: "Working · 1:23" while a turn runs, "Idle" otherwise. */
export function chatStatusLine(input: {
  working: boolean
  workingStartedAt: number | null
  now: number
}): { working: boolean; label: string } {
  if (!input.working) {
    return { working: false, label: 'Idle' }
  }
  if (input.workingStartedAt === null) {
    return { working: true, label: 'Working' }
  }
  return {
    working: true,
    label: `Working · ${formatWorkingElapsed(input.now - input.workingStartedAt)}`
  }
}

/** The model that answered last. Only assistant rows carry one. */
export function chatModelLabel(messages: readonly NativeChatMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const model = messages[index]?.model?.trim()
    if (model) {
      return model
    }
  }
  return null
}

/** The first prompt, collapsed to one line, as the chat's title when it has no other. */
export function chatTitleFromMessages(messages: readonly NativeChatMessage[]): string | null {
  for (const message of messages) {
    if (message.role !== 'user' || message.agentId !== undefined) {
      continue
    }
    const text = message.blocks
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (text) {
      return text.length > 60 ? `${text.slice(0, 59).trimEnd()}…` : text
    }
  }
  return null
}

/** MCP servers the chat's main agent called, in first-use order. Each server is one connector. */
export function chatConnectors(messages: readonly NativeChatMessage[]): MobileChatConnector[] {
  const seen = new Map<string, MobileChatConnector>()
  for (const message of messages) {
    if (message.agentId !== undefined) {
      continue
    }
    for (const block of message.blocks) {
      if (block.type !== 'tool-call') {
        continue
      }
      const server = CONNECTOR_TOOL_NAME.exec(block.name)?.[1]
      if (server && !seen.has(server)) {
        seen.set(server, { id: server, label: server })
      }
    }
  }
  return [...seen.values()]
}

/** Subagents whose latest state is still working. A child is keyed by its id and its latest report
 *  wins, so a child that finished later in the transcript does not count as running. */
export function runningSubagents(messages: readonly NativeChatMessage[]): MobileChatSubagent[] {
  const latest = new Map<string, { label: string; state: string }>()
  for (const message of messages) {
    for (const block of message.blocks) {
      if (block.type !== 'subagent-group') {
        continue
      }
      for (const agent of block.agents) {
        latest.set(agent.id, { label: agent.label, state: agent.state })
      }
    }
  }
  return [...latest]
    .filter(([, entry]) => entry.state === 'working')
    .map(([id, entry]) => ({ id, label: entry.label }))
}

export function buildMobileChatSummaryModel(input: {
  messages: readonly NativeChatMessage[]
}): MobileChatSummaryModel {
  const files = mobileNativeChatRecordedFiles(input.messages)
  return {
    title: chatTitleFromMessages(input.messages),
    model: chatModelLabel(input.messages),
    connectors: chatConnectors(input.messages),
    runningSubagents: runningSubagents(input.messages),
    results: {
      total: files.length,
      preview: files.slice(0, SUMMARY_RESULT_PREVIEW_COUNT)
    }
  }
}
