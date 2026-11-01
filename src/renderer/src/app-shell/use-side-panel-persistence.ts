import { useEffect, useRef } from 'react'
import { isWebClientLocation } from '@/lib/web-client-location'
import { useAppStore } from '../store'

const SAVE_DELAY_MS = 200

/**
 * Saves the side panel's width and per-workspace open choices, and only those two fields, so
 * a write never touches what another client edits. The hydrated values are the baseline.
 */
export function useSidePanelPersistence(): void {
  const ready = useAppStore((s) => s.persistedUIReady)
  const width = useAppStore((s) => s.sidePanelWidth)
  const openByWorktree = useAppStore((s) => s.sidePanelOpenByWorktree)
  const saved = useRef<{ width: number; open: Record<string, boolean> } | null>(null)

  useEffect(() => {
    // Why: the paired web client's UI contract does not carry these fields yet.
    if (!ready || isWebClientLocation()) {
      return
    }
    if (saved.current === null) {
      saved.current = { width, open: openByWorktree }
      return
    }
    if (saved.current.width === width && saved.current.open === openByWorktree) {
      return
    }
    const timer = window.setTimeout(() => {
      saved.current = { width, open: openByWorktree }
      void window.api.ui.set({ sidePanelWidth: width, sidePanelOpenByWorktree: openByWorktree })
    }, SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [openByWorktree, ready, width])
}
