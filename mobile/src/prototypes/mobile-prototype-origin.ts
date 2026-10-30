import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { structuredAgentSessionTabId } from '../../../src/shared/structured-agent-session-projection'
import { paneTabIdOfPaneKey, type WorktreeAgentRows } from '../session/mobile-worktree-agent-rows'

/** The listed pane of a set's parent chat: where it is, and the name the host lists it by, if any. */
export type PrototypeOriginChat = { worktreeId: string; paneKey: string; title: string | null }

/** A set's origin chip: the parent's name (null when it has none), and what a tap does (null when unlisted). */
export type PrototypeOriginChip = { title: string | null; onPress: (() => void) | null }

/**
 * The parent chat a set came from, as the host lists it. A chat with no name still resolves, so it
 * can be opened; `parentChatOf` drops such a chat, which is why the origin used to be hidden.
 */
export function prototypeOriginChatOf(
  sessionId: string,
  worktrees: readonly WorktreeAgentRows[]
): PrototypeOriginChat | null {
  const tabId = structuredAgentSessionTabId(sessionId)
  for (const worktree of worktrees) {
    const agent = worktree.agents.find((pane) => paneTabIdOfPaneKey(pane.paneKey) === tabId)
    if (agent) {
      return { worktreeId: worktree.worktreeId, paneKey: agent.paneKey, title: agent.title ?? null }
    }
  }
  return null
}

/** The origin chip of a set: null for a set made in a chat, else the parent's name and its tap. */
export function originChipOf(
  origin: PrototypeListedSet['origin'],
  worktrees: readonly WorktreeAgentRows[],
  open: (chat: PrototypeOriginChat) => void
): PrototypeOriginChip | null {
  if (origin === undefined) {
    return null
  }
  const chat = prototypeOriginChatOf(origin.sessionId, worktrees)
  return { title: chat?.title ?? null, onPress: chat === null ? null : () => open(chat) }
}
