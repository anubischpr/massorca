// Holds one chat's seen background work across renders and returns what finished. Folds in an
// effect, not during render, because the moment a row is seen to end is read off the live clock.

import { useEffect, useState } from 'react'
import type { AgentChildRowModel } from '../../../src/shared/agent-child-row-model'
import {
  emptySeenBackgroundWork,
  foldSeenBackgroundWork,
  type SeenBackgroundWork
} from './mobile-seen-background-work'

const NO_FINISHED: readonly AgentChildRowModel[] = []

export function useSeenBackgroundWork(args: {
  /** The chat these rows belong to; another chat starts over. */
  scopeKey: string
  /** The roster's running rows as of this render. */
  rows: readonly AgentChildRowModel[]
  /** The feed is being heard; absence on a feed that is not live proves nothing. */
  live: boolean
  /** Reader clock minus the host's, which stamps the rows' clocks. */
  hostClockOffsetMs: number
}): readonly AgentChildRowModel[] {
  const { scopeKey, rows, live, hostClockOffsetMs } = args
  const [seen, setSeen] = useState<SeenBackgroundWork>(() => emptySeenBackgroundWork(scopeKey))
  useEffect(() => {
    // The fold hands back the same object when nothing changed, which bails out of a re-render.
    setSeen((previous) =>
      foldSeenBackgroundWork(previous, {
        scopeKey,
        rows,
        live,
        hostNow: Date.now() - hostClockOffsetMs
      })
    )
  }, [scopeKey, rows, live, hostClockOffsetMs])
  // A render for another chat must not show the last chat's rows while the effect catches up.
  return seen.scopeKey === scopeKey ? seen.finished : NO_FINISHED
}
