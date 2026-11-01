import { useEffect, useRef } from 'react'
import { useAppStore } from '../store'

const SAVE_DELAY_MS = 200

/** Saves the rail mode and its one-time hint flag, and only those two fields, against the hydrated values. */
export function useRailModePersistence(): void {
  const ready = useAppStore((s) => s.persistedUIReady)
  const railMode = useAppStore((s) => s.railMode)
  const hintShown = useAppStore((s) => s.railWorkspacesHintShown)
  const saved = useRef<{ railMode: string; hintShown: boolean } | null>(null)

  useEffect(() => {
    if (!ready) {
      return
    }
    if (saved.current === null) {
      saved.current = { railMode, hintShown }
      return
    }
    if (saved.current.railMode === railMode && saved.current.hintShown === hintShown) {
      return
    }
    const timer = window.setTimeout(() => {
      saved.current = { railMode, hintShown }
      void window.api.ui.set({ railMode, railWorkspacesHintShown: hintShown })
    }, SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [hintShown, railMode, ready])
}
