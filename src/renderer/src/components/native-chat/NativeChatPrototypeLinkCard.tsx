import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { prototypeTitle } from '../../../../shared/prototype-list-model'
import { usePrototypeViewStore } from '../prototypes/prototype-view-store'
import { usePrototypeSetForRequest } from '../prototypes/use-prototype-set-for-request'

/** Under a prototype request: the set it made, opening it in the Prototypes view. */
export function NativeChatPrototypeLinkCard({
  requestId
}: {
  requestId: string
}): React.JSX.Element | null {
  const set = usePrototypeSetForRequest(requestId)
  if (set === null) {
    return null
  }
  const title = translate('components.prototypes.link.setOf', '{{title}} · set of {{count}}', {
    title: prototypeTitle(set),
    count: set.count
  })
  return (
    <button
      type="button"
      data-native-chat-prototype-link-card="true"
      onClick={() => {
        usePrototypeViewStore.getState().selectRequest(requestId)
        useAppStore.getState().setActiveView('prototypes')
      }}
      className="flex w-[420px] max-w-full cursor-pointer items-center justify-between gap-3 self-start rounded-xl border border-border p-3 text-left text-sm text-foreground hover:bg-accent"
    >
      <span className="min-w-0 truncate">{title}</span>
      <span className="shrink-0 text-muted-foreground">
        {translate('components.prototypes.link.open', 'Open in Prototypes ›')}
      </span>
    </button>
  )
}
