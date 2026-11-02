import { useId, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import {
  applyBotTeamComposerItem,
  BOT_TEAM_ROOM_COMMANDS,
  botTeamComposerMenu,
  botTeamMentionOpen,
  type BotTeamComposerItem
} from '../../../../shared/bot-team-composer-menu'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotTeamComposerMenu } from './BotTeamComposerMenu'
import { openBotTeamRoomSessions } from './open-bot-team-room-sessions'
import { useBotTeamFilePaths } from './use-bot-team-files'

/** The room's message box with its @ and / menu; `onSend` resolves true once the host took the text. */
export function BotTeamRoomComposer({
  team,
  offline,
  onSend
}: {
  team: BotTeam
  offline: boolean
  onSend: (text: string) => Promise<boolean>
}): React.JSX.Element {
  const [text, setText] = useState('')
  const [caret, setCaret] = useState(0)
  const [menuIndex, setMenuIndex] = useState(0)
  const [menuDismissed, setMenuDismissed] = useState(false)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const menuId = useId()
  const files = useBotTeamFilePaths(team.id, !offline && botTeamMentionOpen(text, caret))
  const menu =
    menuDismissed || offline
      ? null
      : botTeamComposerMenu({
          text,
          caret,
          bots: team.bots,
          files,
          commands: BOT_TEAM_ROOM_COMMANDS
        })
  const chooseMenuItem = (item: BotTeamComposerItem): void => {
    if (!menu) {
      return
    }
    if (item.kind === 'command') {
      setText('')
      setCaret(0)
      void openBotTeamRoomSessions()
      return
    }
    const next = applyBotTeamComposerItem(text, menu, item)
    setText(next.text)
    setCaret(next.caret)
    setMenuIndex(0)
    requestAnimationFrame(() => {
      composerRef.current?.focus()
      composerRef.current?.setSelectionRange(next.caret, next.caret)
    })
  }
  const send = async (): Promise<void> => {
    if (await onSend(text.trim())) {
      setText('')
    }
  }

  return (
    <div className="shrink-0 px-4 pb-4 pt-2">
      <div className="relative mx-auto flex max-w-[736px] items-end gap-2 rounded-xl border border-input p-1.5">
        {menu ? (
          <BotTeamComposerMenu
            menu={menu}
            activeIndex={menuIndex}
            listboxId={menuId}
            onChoose={chooseMenuItem}
          />
        ) : null}
        <Textarea
          className="min-h-12 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          aria-label={translate('components.botTeams.messageTeam', 'Message the team')}
          placeholder={
            offline
              ? translate(
                  'components.botTeams.writeWhenBack',
                  'You can write again when this host is back'
                )
              : translate(
                  'components.botTeams.messageTeamHint',
                  'Message the team, or type @ to ask one bot'
                )
          }
          disabled={offline}
          value={text}
          ref={composerRef}
          role="combobox"
          aria-expanded={menu !== null}
          aria-controls={menu ? menuId : undefined}
          aria-activedescendant={menu ? `${menuId}-option-${menuIndex}` : undefined}
          onChange={(event) => {
            setText(event.target.value)
            setCaret(event.target.selectionStart)
            setMenuIndex(0)
            setMenuDismissed(false)
          }}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          onKeyDown={(event) => {
            if (!menu) {
              return
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              const step = event.key === 'ArrowDown' ? 1 : -1
              setMenuIndex((menuIndex + step + menu.items.length) % menu.items.length)
            } else if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault()
              chooseMenuItem(menu.items[menuIndex])
            } else if (event.key === 'Escape') {
              setMenuDismissed(true)
            }
          }}
        />
        <Button
          size="icon"
          className="rounded-full"
          aria-label={translate('components.botTeams.send', 'Send')}
          disabled={offline || text.trim() === ''}
          onClick={() => void send()}
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
    </div>
  )
}
