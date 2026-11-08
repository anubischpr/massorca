import React from 'react'
import { ListChecks, MessagesSquare, Plus } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useOptionalShortcutLabel } from '@/hooks/useShortcutLabel'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut
} from '@/components/ui/dropdown-menu'

const ITEM_CLASS = 'gap-2 rounded-[7px] px-2 py-1.5 text-[12px] leading-5 font-medium'

/**
 * The end of the floating workspace's "+" menu: a separator, "New Session" when the panel offers
 * it, the Checklist tab, then "Open a session..." when the panel offers it.
 */
export function TabBarChecklistMenuItem({
  onNewSession,
  onNewChecklistTab,
  onOpenSessionPicker
}: {
  onNewSession?: () => void
  onNewChecklistTab: () => void
  onOpenSessionPicker?: () => void
}): React.JSX.Element {
  const checklistShortcut = useOptionalShortcutLabel('tab.newChecklist')
  const openSessionShortcut = useOptionalShortcutLabel('tab.openSession')
  return (
    <>
      <DropdownMenuSeparator />
      {onNewSession ? (
        <DropdownMenuItem onSelect={onNewSession} className={ITEM_CLASS}>
          <Plus className="size-4 text-muted-foreground" />
          {translate('components.tabBar.newSession', 'New Session')}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem onSelect={onNewChecklistTab} className={ITEM_CLASS}>
        <ListChecks className="size-4 text-muted-foreground" />
        {translate('components.tabBar.checklist', 'Checklist')}
        {checklistShortcut ? (
          <DropdownMenuShortcut>{checklistShortcut}</DropdownMenuShortcut>
        ) : null}
      </DropdownMenuItem>
      {onOpenSessionPicker ? (
        <DropdownMenuItem onSelect={onOpenSessionPicker} className={ITEM_CLASS}>
          <MessagesSquare className="size-4 text-muted-foreground" />
          {translate('components.tabBar.openSession', 'Open a session...')}
          {openSessionShortcut ? (
            <DropdownMenuShortcut>{openSessionShortcut}</DropdownMenuShortcut>
          ) : null}
        </DropdownMenuItem>
      ) : null}
    </>
  )
}
