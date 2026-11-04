import { createElement, Fragment, useEffect, useRef } from 'react'
import { translate } from '@/i18n/i18n'
import { getFileTypeIcon } from '@/lib/file-type-icons'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import {
  PickerHeading,
  PickerListbox,
  PickerOptionButton
} from '@/components/native-chat/NativeChatAutocompleteMenus'
import type {
  BotTeamComposerItem,
  BotTeamComposerMenu as Menu
} from '../../../../shared/bot-team-composer-menu'
import { BotAgentIcon } from './BotAgentIcon'
import { BotTeamCharacterIcon } from './BotTeamCharacterIcon'

function itemKey(item: BotTeamComposerItem): string {
  switch (item.kind) {
    case 'bot':
      return item.bot.id
    case 'team':
      return item.team.id
    case 'project':
      return `project:${item.project.id}`
    default:
      return item.insert
  }
}

function groupHeading(kind: BotTeamComposerItem['kind']): string | null {
  switch (kind) {
    case 'bot':
      return translate('components.botTeams.mentionBots', 'Bots')
    case 'team':
      return translate('components.botTeams.mentionTeams', 'Teams')
    case 'project':
      return translate('components.botTeams.projects', 'Projects')
    case 'file':
      return translate('components.botTeams.mentionFiles', 'Files')
    case 'command':
      return null
  }
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
  if (item.kind === 'team') {
    return (
      <>
        <BotTeamCharacterIcon character={item.team.character} size={16} />
        <span className="min-w-0 flex-1 truncate font-medium">{item.team.name}</span>
      </>
    )
  }
  if (item.kind === 'project') {
    return (
      <>
        {/* A project without a logo shows its name alone. */}
        {item.project.logo ? (
          <RepoIconGlyph repoIcon={item.project.logo} className="mt-0.5 size-3.5 shrink-0" />
        ) : null}
        <span className="min-w-0 flex-1 truncate font-medium">{item.project.name}</span>
      </>
    )
  }
  if (item.kind === 'file') {
    return (
      <>
        {createElement(getFileTypeIcon(item.path), {
          className: 'mt-0.5 size-3.5 shrink-0 text-muted-foreground'
        })}
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

/** The room's @ and / menu, on the session composer's own list and row; kinds get headings when mixed. */
export function BotTeamComposerMenu({
  menu,
  activeIndex,
  listboxId,
  placement,
  onChoose
}: {
  menu: Menu
  activeIndex: number
  listboxId: string
  placement?: 'above' | 'below'
  onChoose: (item: BotTeamComposerItem) => void
}): React.JSX.Element {
  const activeItemRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, menu.items])
  const mixed = new Set(menu.items.map((item) => item.kind)).size > 1
  return (
    <PickerListbox id={listboxId} placement={placement}>
      {menu.items.map((item, index) => {
        const heading =
          mixed && item.kind !== menu.items[index - 1]?.kind ? groupHeading(item.kind) : null
        return (
          <Fragment key={itemKey(item)}>
            {heading ? <PickerHeading>{heading}</PickerHeading> : null}
            <PickerOptionButton
              id={`${listboxId}-option-${index}`}
              selected={index === activeIndex}
              activeItemRef={activeItemRef}
              onChoose={() => onChoose(item)}
              filePath={item.kind === 'file' ? item.path : undefined}
            >
              <ItemRow item={item} />
            </PickerOptionButton>
          </Fragment>
        )
      })}
    </PickerListbox>
  )
}
