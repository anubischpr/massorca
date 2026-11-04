import type { ContextType, ReactNode } from 'react'
import { MobileNativeChatChecklistContext } from './mobile-native-chat-checklist-context'
import { MobileNativeChatVisualContext } from './mobile-native-chat-visual-context'
import type { MobileNativeChatChecklistView } from './use-mobile-native-chat-checklist'

/** What the transcript's rows draw from the chat: its visuals and its checklist. */
export function MobileNativeChatTranscriptContexts({
  visuals,
  checklist,
  children
}: {
  visuals: ContextType<typeof MobileNativeChatVisualContext>
  checklist: MobileNativeChatChecklistView | null
  children: ReactNode
}): React.JSX.Element {
  return (
    <MobileNativeChatVisualContext.Provider value={visuals}>
      <MobileNativeChatChecklistContext.Provider value={checklist}>
        {children}
      </MobileNativeChatChecklistContext.Provider>
    </MobileNativeChatVisualContext.Provider>
  )
}
