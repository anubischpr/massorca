import type { AiVaultSession } from './ai-vault-types'

export type AiVaultDelegatedNesting = {
  /** The shown rows that display at top level, in list order: no nested child is among them. */
  roots: AiVaultSession[]
  /** The children displayed under each root's id, in list order. */
  childrenByRootId: ReadonlyMap<string, AiVaultSession[]>
}

type Display = { kind: 'root' } | { kind: 'nested'; rootId: string } | { kind: 'hidden' }

/**
 * Nests each delegated child under the parent it names, when that parent is displayed.
 *
 * `inScope` is every row the scope, agent, empty and query filters keep, and `shown` is the subset
 * the Automated runs switch leaves. Children come from `inScope`, so the switch never hides a child
 * from its visible parent. A child whose parent is not displayed is a root when `shown` lists it and
 * hidden otherwise. A child of a nested child nests under the same root, since the list has one level.
 */
export function nestAiVaultDelegatedChildren(
  inScope: readonly AiVaultSession[],
  shown: readonly AiVaultSession[]
): AiVaultDelegatedNesting {
  const shownIds = new Set(shown.map((session) => session.id))
  const byStructuredId = new Map<string, AiVaultSession>()
  for (const session of inScope) {
    const structuredId = session.structuredSession?.sessionId
    if (structuredId) {
      byStructuredId.set(structuredKey(session.executionHostId, structuredId), session)
    }
  }
  const parentOf = (session: AiVaultSession): AiVaultSession | null => {
    const parentSessionId = session.delegatedFrom?.parentSessionId
    if (!parentSessionId) {
      return null
    }
    const parent = byStructuredId.get(structuredKey(session.executionHostId, parentSessionId))
    return parent && parent.id !== session.id ? parent : null
  }

  const displays = new Map<string, Display>()
  const displayOf = (session: AiVaultSession): Display => {
    const known = displays.get(session.id)
    if (known) {
      return known
    }
    // Why: a cycle reads its member as an unlisted parent, so every row still resolves once.
    displays.set(session.id, { kind: 'hidden' })
    const parent = parentOf(session)
    const parentDisplay = parent ? displayOf(parent) : null
    const display: Display =
      parent && parentDisplay && parentDisplay.kind !== 'hidden'
        ? {
            kind: 'nested',
            rootId: parentDisplay.kind === 'root' ? parent.id : parentDisplay.rootId
          }
        : shownIds.has(session.id)
          ? { kind: 'root' }
          : { kind: 'hidden' }
    displays.set(session.id, display)
    return display
  }

  const roots = shown.filter((session) => displayOf(session).kind === 'root')
  const childrenByRootId = new Map<string, AiVaultSession[]>()
  for (const session of inScope) {
    const display = displayOf(session)
    if (display.kind === 'nested') {
      const children = childrenByRootId.get(display.rootId)
      if (children) {
        children.push(session)
      } else {
        childrenByRootId.set(display.rootId, [session])
      }
    }
  }
  return { roots, childrenByRootId }
}

function structuredKey(executionHostId: string, sessionId: string): string {
  return JSON.stringify([executionHostId, sessionId])
}
