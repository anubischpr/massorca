import { MobileChecklistSheet } from './MobileChecklistSheet'
import { MobileChecklistItemSheet } from './MobileChecklistItemSheet'
import type { MobileNativeChatChecklistView } from './use-mobile-native-chat-checklist'

/** The Checklist sheet and the item sheet a chat opens from its header menu and its transcript row. */
export function MobileNativeChatChecklistSheets({
  view,
  agentLabel,
  onSendNow
}: {
  view: MobileNativeChatChecklistView
  agentLabel: string
  onSendNow: () => void
}): React.JSX.Element {
  return (
    <>
      <MobileChecklistSheet
        visible={view.listOpen}
        checklist={view.checklist}
        writtenAt={view.writtenAt}
        agentLabel={agentLabel}
        readOnly={view.readOnly}
        onClose={view.closeList}
        onToggle={(item) => {
          void view.toggleItem(item)
        }}
        onOpenItem={view.openItem}
        onAddItem={view.addItem}
        onSendNow={onSendNow}
      />
      <MobileNativeChatChecklistItemSheet view={view} agentLabel={agentLabel} />
    </>
  )
}

/** The item sheet alone, for a surface that lists the items itself (the chat's Summary). */
export function MobileNativeChatChecklistItemSheet({
  view,
  agentLabel
}: {
  view: MobileNativeChatChecklistView
  agentLabel: string
}): React.JSX.Element {
  const items = view.checklist?.items ?? []
  const activeIndex = items.findIndex((item) => item.key === view.activeKey)
  const activeItem = activeIndex === -1 ? null : (items[activeIndex] ?? null)
  return (
    <MobileChecklistItemSheet
      key={view.itemOpenCount}
      visible={activeItem !== null}
      item={activeItem}
      position={activeIndex + 1}
      total={items.length}
      agentLabel={agentLabel}
      readOnly={view.readOnly}
      onClose={view.closeItem}
      onSave={(change) => (activeItem ? view.saveItem(activeItem.key, change) : Promise.resolve(false))}
      onRemove={() => (activeItem ? view.removeItem(activeItem.key) : Promise.resolve(false))}
      onPickScreenshot={view.pickScreenshot}
    />
  )
}
