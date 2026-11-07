import { useSyncExternalStore } from 'react'
import type { CatalogRow } from './MarketplaceCatalogRows'

/** A skill row a sidebar click asks the Marketplace page to open on its own page. */
export type SkillRowOpenRequest = { row: CatalogRow }

// Why: the sidebar and the Marketplace page are separate trees; the page owns the skill scan, so the sidebar hands it the row.
let pending: SkillRowOpenRequest | null = null
const listeners = new Set<() => void>()

function publish(next: SkillRowOpenRequest | null): void {
  pending = next
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): SkillRowOpenRequest | null {
  return pending
}

export function requestSkillRowOpen(row: CatalogRow): void {
  publish({ row })
}

export function clearSkillRowOpenRequest(): void {
  if (pending !== null) {
    publish(null)
  }
}

/** The pending sidebar request, or null once the page has taken it. */
export function useSkillRowOpenRequest(): SkillRowOpenRequest | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
