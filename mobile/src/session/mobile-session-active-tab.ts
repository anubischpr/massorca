/**
 * The tab that becomes active when the active tab closes: the one that took its place, or the new last
 * tab when the closed one was last. Null only when no tab remains.
 */
export function neighbourTabAfterClose<Tab extends { id: string }>(
  remainingTabs: readonly Tab[],
  closedIndex: number
): Tab | null {
  if (remainingTabs.length === 0) {
    return null
  }
  const at = Math.min(Math.max(closedIndex, 0), remainingTabs.length - 1)
  return remainingTabs[at] ?? null
}

/**
 * The kind of the active tab while the screen cannot yet find that tab in its list (a new terminal's
 * raw handle, before its tab is listed). The last kind the screen knew stands in, so the top bar does
 * not reset to pending.
 */
export function resolveMobileSessionActiveKind<Kind extends string>(
  activeTabKind: Kind | null | undefined,
  lastKnownKind: Kind | null
): Kind | null {
  return activeTabKind ?? lastKnownKind
}
