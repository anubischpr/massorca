// The delegated children a structured chat started, read from its journal: the live started row in
// the transcript and the child sessions in the background sheet.

import { createContext, useMemo } from 'react'
import {
  delegatedChildrenFromJournal,
  type DelegatedChild,
  type DelegatedChildJournalItem
} from '../../../src/shared/delegated-children'
import { MAX_FINISHED_BACKGROUND_ROWS } from './mobile-seen-background-work'
import { durationText } from './mobile-delegation-notice-words'

export type MobileDelegatedChildren = {
  children: readonly DelegatedChild[]
  /** Reader clock minus host clock, so a host-stamped start reads on this phone's clock. */
  hostClockOffsetMs: number
}

const NO_CHILDREN: readonly DelegatedChild[] = []

/** Empty where no structured chat is at hand, so a notice shows its plain line. */
export const NO_DELEGATED_CHILDREN: MobileDelegatedChildren = {
  children: NO_CHILDREN,
  hostClockOffsetMs: 0
}

export const MobileDelegatedChildrenContext =
  createContext<MobileDelegatedChildren>(NO_DELEGATED_CHILDREN)

/** The children a chat's journal holds, derived once per journal change. */
export function useDelegatedChildrenFromJournal(
  items: readonly DelegatedChildJournalItem[] | undefined,
  hostClockOffsetMs: number
): MobileDelegatedChildren {
  const children = useMemo(() => delegatedChildrenFromJournal(items ?? []), [items])
  return useMemo(() => ({ children, hostClockOffsetMs }), [children, hostClockOffsetMs])
}

export function runningDelegatedChildren(children: readonly DelegatedChild[]): DelegatedChild[] {
  return children.filter((child) => child.status === 'working')
}

/** Settled children, newest started first, bounded like the finished rows. */
export function finishedDelegatedChildren(children: readonly DelegatedChild[]): DelegatedChild[] {
  return children
    .filter((child) => child.status !== 'working')
    .sort((left, right) => (right.startedAt ?? 0) - (left.startedAt ?? 0))
    .slice(0, MAX_FINISHED_BACKGROUND_ROWS)
}

/** A child's clock: the time it has run while it works, the reported duration once it settles. */
export function delegatedChildClockText(child: DelegatedChild, hostNow: number): string | null {
  if (child.status === 'working') {
    return child.startedAt === null ? null : durationText(Math.max(0, hostNow - child.startedAt))
  }
  return durationText(child.durationMs)
}

/** What a sheet's child rows read and open: the running and settled children, and whether each opens. */
export type BackgroundChildSessions = {
  running: readonly DelegatedChild[]
  finished: readonly DelegatedChild[]
  canOpen: (childSessionId: string) => boolean
  open: (childSessionId: string) => void
}
