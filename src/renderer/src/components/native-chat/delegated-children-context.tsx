import { createContext, useContext, useMemo } from 'react'
import {
  delegatedChildrenFromJournal,
  type DelegatedChild,
  type DelegatedChildJournalItem
} from '../../../../shared/delegated-children'

const NO_CHILDREN: ReadonlyMap<string, DelegatedChild> = new Map()
const DelegatedChildrenContext = createContext<ReadonlyMap<string, DelegatedChild>>(NO_CHILDREN)

/** Gives the chat's notice rows the child each request now is, keyed by request id. */
export function DelegatedChildrenProvider({
  journalItems,
  children
}: {
  journalItems: readonly DelegatedChildJournalItem[]
  children: React.ReactNode
}): React.JSX.Element {
  const byRequest = useMemo(
    () =>
      new Map(
        delegatedChildrenFromJournal(journalItems).map((child) => [child.requestId, child] as const)
      ),
    [journalItems]
  )
  return (
    <DelegatedChildrenContext.Provider value={byRequest}>
      {children}
    </DelegatedChildrenContext.Provider>
  )
}

/** The child a request started, as this chat's journal now shows it; null outside a provider. */
export function useDelegatedChild(requestId: string): DelegatedChild | null {
  return useContext(DelegatedChildrenContext).get(requestId) ?? null
}
