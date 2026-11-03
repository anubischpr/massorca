import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { useImeEnterGestureOwnership } from '@/lib/ime-composition-keyboard-event'
import { useNativeChatComposerKeyDown } from '../native-chat/use-native-chat-composer-keydown'
import {
  applyBotTeamComposerItem,
  BOT_TEAM_ROOM_COMMANDS,
  botTeamComposerMenu,
  botTeamMentionOpen,
  type BotTeamComposerItem
} from '../../../../shared/bot-team-composer-menu'
import {
  removeBotTeamMentionBeforeCaret,
  type BotTeamMentionName
} from '../../../../shared/bot-team-mention-text'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotTeamComposerMenu } from './BotTeamComposerMenu'
import { openBotTeamRoomSessions } from './open-bot-team-room-sessions'
import { useBotTeamFilePaths } from './use-bot-team-files'

const NO_TEAMS: readonly BotTeam[] = []

/** The room's message box with its @ and / menu; `onSend` resolves true once the host took the text. */
export function BotTeamRoomComposer({
  team,
  otherTeams = NO_TEAMS,
  offline,
  onSend
}: {
  team: BotTeam
  /** `@Name` of one of these sends the request to that team. */
  otherTeams?: readonly BotTeam[]
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
  const mentionNames = useMemo<BotTeamMentionName[]>(
    () => [
      ...team.bots.map((bot) => ({ name: bot.name, kind: 'bot' as const })),
      ...otherTeams.map((entry) => ({ name: entry.name, kind: 'team' as const }))
    ],
    [team.bots, otherTeams]
  )
  const menu =
    menuDismissed || offline
      ? null
      : botTeamComposerMenu({
          text,
          caret,
          bots: team.bots,
          teams: otherTeams,
          files,
          commands: BOT_TEAM_ROOM_COMMANDS
        })
  // Why: the box starts one line tall and grows only with typed lines, up to the Tailwind max height.
  useLayoutEffect(() => {
    const box = composerRef.current
    if (!box) {
      return
    }
    box.style.height = 'auto'
    box.style.height = `${box.scrollHeight}px`
  }, [text])
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
    const sent = text
    if (sent.trim() === '') {
      return
    }
    // Clears at once, as Workspaces does; a refused send puts the text back unless more was typed.
    setText('')
    setCaret(0)
    if (!(await onSend(sent.trim()))) {
      setText((current) => (current === '' ? sent : current))
    }
  }
  // Why: a picked mention is plain "@Name" text, so Backspace right after it takes the whole mention.
  const removeMentionBeforeCaret = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    const box = event.currentTarget
    if (
      event.key !== 'Backspace' ||
      event.nativeEvent.isComposing ||
      box.selectionStart !== box.selectionEnd
    ) {
      return false
    }
    const next = removeBotTeamMentionBeforeCaret(box.value, box.selectionStart, mentionNames)
    if (!next) {
      return false
    }
    event.preventDefault()
    setText(next.text)
    setCaret(next.caret)
    requestAnimationFrame(() => box.setSelectionRange(next.caret, next.caret))
    return true
  }
  const imeEnterGesture = useImeEnterGestureOwnership()
  // The Workspaces composer's keys; the room menu rides its mention mode, each item keyed by index.
  const onKeyDown = useNativeChatComposerKeyDown({
    autocomplete: menu
      ? { mode: 'mention', query: '', triggerKey: String(menu.start) }
      : { mode: 'none' },
    mentionFiles: {
      files: menu ? menu.items.map((_item, index) => String(index)) : [],
      loading: false,
      failed: false
    },
    completeMention: (index) => {
      const item = menu?.items[Number(index)]
      if (item) {
        chooseMenuItem(item)
      }
    },
    activeSuggestion: menuIndex,
    draft: text,
    isComposing: imeEnterGesture.isComposing,
    completePickerItem: () => {},
    dispatchPickerCommand: () => {},
    dismissPicker: () => setMenuDismissed(true),
    interrupt: () => {},
    send: () => void send(),
    setActiveSuggestion: setMenuIndex,
    setDraft: setText,
    setCaret
  })

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
          rows={1}
          className="scrollbar-sleek max-h-40 min-h-9 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
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
          onKeyDownCapture={(event) => {
            if (!imeEnterGesture.ownsKeyDown(event) && !removeMentionBeforeCaret(event)) {
              onKeyDown(event)
            }
          }}
          onKeyUp={imeEnterGesture.onKeyUp}
          onCompositionStart={() => imeEnterGesture.setComposing(true)}
          onCompositionEnd={imeEnterGesture.onCompositionEnd}
          onBlur={imeEnterGesture.reset}
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
