import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { NativeChatEarlierContext } from './use-structured-agent-session-cleared-view'
import type { NativeChatOlderHistoryAutoload } from './use-native-chat-older-history-autoload'

/** Pages that land quickly (local reads) should not flash a label. */
const LOADING_LABEL_DELAY_MS = 200

function DelayedLoadingLabel(): React.JSX.Element | null {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), LOADING_LABEL_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])
  return visible ? (
    <>{translate('components.native-chat.loadingEarlierMessages', 'Loading earlier messages…')}</>
  ) : null
}

/** Top of the transcript while older history remains or a /clear hides the conversation before it:
 *  the auto-load sentinel, a quiet status line, a manual load only once auto-load has stopped, and
 *  the control that shows or hides what came before the newest /clear.
 *  Rendered as a direct child of the (positioned) transcript scroller. */
export function NativeChatOlderHistoryRow({
  olderHistory,
  loadingEarlier,
  hasOlder,
  earlierContext
}: {
  olderHistory: NativeChatOlderHistoryAutoload
  loadingEarlier: boolean
  hasOlder: boolean
  earlierContext: NativeChatEarlierContext | null
}): React.JSX.Element {
  return (
    // Out of flow, inside the scroller's top padding: its coming and going must
    // never move the window, least of all when the last page takes it away.
    <div
      ref={olderHistory.sentinelRef}
      className="absolute inset-x-0 top-0 flex h-10 items-center justify-center gap-2"
    >
      {hasOlder && olderHistory.isAutoLoadEnabled ? (
        <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {loadingEarlier ? <DelayedLoadingLabel /> : null}
        </span>
      ) : null}
      {hasOlder && !olderHistory.isAutoLoadEnabled ? (
        <Button
          variant="ghost"
          size="xs"
          onClick={olderHistory.loadEarlierManually}
          disabled={loadingEarlier}
        >
          {loadingEarlier
            ? translate('components.native-chat.loadingEarlier', 'Loading…')
            : translate('components.native-chat.loadEarlier', 'Load earlier messages')}
        </Button>
      ) : null}
      {earlierContext ? (
        <Button variant="ghost" size="xs" onClick={earlierContext.toggle}>
          {earlierContext.shown
            ? translate(
                'components.native-chat.hideEarlierConversation',
                'Hide earlier conversation'
              )
            : translate(
                'components.native-chat.showEarlierConversation',
                'Show earlier conversation'
              )}
        </Button>
      ) : null}
    </div>
  )
}
