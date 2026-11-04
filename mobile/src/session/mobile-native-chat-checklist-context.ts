import { createContext } from 'react'
import type { MobileNativeChatChecklistView } from './use-mobile-native-chat-checklist'

/** The chat's checklist, for the transcript rows that stand in for its fences. Null outside a chat. */
export const MobileNativeChatChecklistContext = createContext<MobileNativeChatChecklistView | null>(
  null
)
