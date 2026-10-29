import { MessageSquare, SquareTerminal } from 'lucide-react-native'
import type { ActionSheetAction } from '../components/ActionSheetModal'
import { MOBILE_LEGACY_SESSION_VIEWS } from './mobile-legacy-session-views'
import { resolveMobileNativeChat, type MobileNativeChatTab } from './mobile-native-chat-eligibility'

type ToggleTab = MobileNativeChatTab & {
  id: string
  terminal: string | null
}

/** Builds the optional terminal/chat switch shown in a terminal's long-press menu. */
export function getMobileNativeChatToggleActions(args: {
  terminalHandle: string | null
  tabs: readonly ToggleTab[]
  isTabChatView: (tabId: string) => boolean
  nativeChatTranscriptIsLocalReadable: boolean
  onClose: () => void
  onToggle: (tabId: string) => void
  /** Defaults to the kill switch. */
  legacyViews?: boolean
}): ActionSheetAction[] {
  const { terminalHandle, tabs, isTabChatView, onClose, onToggle } = args
  if (!(args.legacyViews ?? MOBILE_LEGACY_SESSION_VIEWS)) {
    return []
  }
  const tab = terminalHandle
    ? tabs.find((candidate) => candidate.terminal === terminalHandle)
    : null
  if (!tab || !resolveMobileNativeChat(tab, args.nativeChatTranscriptIsLocalReadable)) {
    return []
  }
  const isChat = isTabChatView(tab.id)
  return [
    {
      label: isChat ? 'Switch to terminal view' : 'Switch to chat view',
      icon: isChat ? SquareTerminal : MessageSquare,
      onPress: () => {
        onClose()
        onToggle(tab.id)
      }
    }
  ]
}
