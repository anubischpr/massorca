import type { WorktreeCardMode } from '../ui-chrome-types'

export type WorktreeCardLayout = 'one-line' | 'detailed' | 'compact'

export const DEFAULT_WORKTREE_CARD_LAYOUT: WorktreeCardLayout = 'one-line'

const WORKTREE_CARD_LAYOUTS: readonly WorktreeCardLayout[] = ['one-line', 'detailed', 'compact']

export function normalizeWorktreeCardLayout(value: unknown): WorktreeCardLayout | undefined {
  return WORKTREE_CARD_LAYOUTS.find((layout) => layout === value)
}

/** `{ worktreeCardLayout }` for a known value, else `{}`, so a spread never overwrites with undefined. */
export function pickWorktreeCardLayout(value: unknown): {
  worktreeCardLayout?: WorktreeCardLayout
} {
  const worktreeCardLayout = normalizeWorktreeCardLayout(value)
  return worktreeCardLayout ? { worktreeCardLayout } : {}
}

type WorktreeCardLayoutSettings = {
  compactWorktreeCards?: boolean
  worktreeCardLayout?: WorktreeCardLayout
}

/**
 * The layout the sidebar renders. An explicit `worktreeCardLayout` wins; profiles that predate it
 * keep Compact when `compactWorktreeCards` was switched on and otherwise get the new default.
 * `false` is the old shipped default, so it cannot tell a deliberate Detailed from an untouched
 * profile and is treated as unset.
 */
export function resolveWorktreeCardLayout(
  settings: WorktreeCardLayoutSettings | null | undefined
): WorktreeCardLayout {
  // Settings not hydrated yet: keep the long-standing Detailed card instead of flashing a layout.
  if (!settings) {
    return 'detailed'
  }
  const explicit = normalizeWorktreeCardLayout(settings.worktreeCardLayout)
  if (explicit) {
    return explicit
  }
  return settings.compactWorktreeCards === true ? 'compact' : DEFAULT_WORKTREE_CARD_LAYOUT
}

/**
 * The layout one card surface renders. Sidebar rows show the layout setting. The folder panel and the
 * kanban card read the same resolved layout, so a bare layout write is not hidden by a stale compact
 * flag. The experimental card style still wins.
 */
export function resolveWorktreeCardSurfaceLayout(
  settings:
    | (WorktreeCardLayoutSettings & { experimentalNewWorktreeCardStyle?: boolean })
    | null
    | undefined,
  sidebarRow: boolean
): WorktreeCardLayout {
  if (settings?.experimentalNewWorktreeCardStyle === true) {
    return 'detailed'
  }
  if (sidebarRow) {
    return resolveWorktreeCardLayout(settings)
  }
  // Why: One line has no non-sidebar form, so it falls back to Detailed here.
  return resolveWorktreeCardLayout(settings) === 'compact' ? 'compact' : 'detailed'
}

export function getWorktreeCardModeForLayout(layout: string): WorktreeCardMode {
  const normalized = normalizeWorktreeCardLayout(layout)
  if (normalized === 'compact') {
    return 'Compact'
  }
  return normalized === 'detailed' ? 'Default' : 'OneLine'
}
