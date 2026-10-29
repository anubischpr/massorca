import type { ComponentProps } from 'react'
import type { DelegatedChildJournalItem } from '../../../../shared/delegated-children'
import { DelegatedChildrenProvider } from './delegated-children-context'
import { NativeChatMessageList } from './NativeChatMessageList'

const NO_JOURNAL_ITEMS: readonly DelegatedChildJournalItem[] = []

/** The transcript, with its notice rows able to read each delegated child's live state. */
export function NativeChatMessageListWithDelegatedChildren(
  props: ComponentProps<typeof NativeChatMessageList>
): React.JSX.Element {
  return (
    <DelegatedChildrenProvider journalItems={props.journalItems ?? NO_JOURNAL_ITEMS}>
      <NativeChatMessageList {...props} />
    </DelegatedChildrenProvider>
  )
}
