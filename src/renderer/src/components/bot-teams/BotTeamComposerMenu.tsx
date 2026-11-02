import { useEffect, useRef } from 'react'
import { translate } from '@/i18n/i18n'
import { getFileTypeIcon } from '@/lib/file-type-icons'
import {
  PickerListbox,
  PickerOptionButton
} from '@/components/native-chat/NativeChatAutocompleteMenus'
import type {
  BotTeamComposerItem,
  BotTeamComposerMenu as Menu
} from '../../../../shared/bot-team-composer-menu'
import { BotAgentIcon } from './BotAgentIcon'

function itemKey(item: BotTeamComposerItem): string {
  return item.kind === 'bot' ? item.bot.id : item.insert
}

function ItemRow({ item }: { item: BotTeamComposerItem }): React.JSX.Element {
  if (item.kind === 'bot') {
    return (
      <>
        <BotAgentIcon agent={item.bot.agent} size={14} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.bot.name}</span>
          {item.bot.job ? (
            <span className="block truncate text-xs text-muted-foreground">{item.bot.job}</span>
          ) : null}
        </span>
      </>
    )
  }
  if (item.kind === 'file') {
    const FileIcon = getFileTypeIcon(item.path)
    return (
      <>
        <FileIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{item.path}</span>
      </>
    )
  }
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-mono font-medium">{item.insert}</span>
      <span className="block truncate text-xs text-muted-foreground">
        {item.command === 'resume'
          ? translate(
              'components.native-chat.composer.resumeWindowDescription',
              'Choose an existing session in the Sessions panel'
            )
          : translate(
              'components.native-chat.composer.sessionWindowDescription',
              'Browse sessions in the Sessions panel'
            )}
      </span>
    </span>
  )
}

/** The room's @ and / menu, on the session composer's own list and row. */
export function BotTeamComposerMenu({
  menu,
  activeIndex,
  listboxId,
  onChoose
}: {
  menu: Menu
  activeIndex: number
  listboxId: string
  onChoose: (item: BotTeamComposerItem) => void
}): React.JSX.Element {
  const activeItemRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, menu.items])
  return (
    <PickerListbox id={listboxId}>
      {menu.items.map((item, index) => (
        <PickerOptionButton
          key={itemKey(item)}
          id={`${listboxId}-option-${index}`}
          selected={index === activeIndex}
          activeItemRef={activeItemRef}
          onChoose={() => onChoose(item)}
        >
          <ItemRow item={item} />
        </PickerOptionButton>
      ))}
    </PickerListbox>
  )
}
