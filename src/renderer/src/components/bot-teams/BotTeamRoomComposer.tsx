import { useId, useLayoutEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { ArrowUp, Plus, X } from 'lucide-react'
import { EditorContent } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useImeEnterGestureOwnership } from '@/lib/ime-composition-keyboard-event'
import { useNativeChatComposerKeyDown } from '../native-chat/use-native-chat-composer-keydown'
import { promptTextMap, promptTextOffset } from '../native-chat/native-chat-prompt-document'
import {
  botTeamComposerMenu,
  BOT_TEAM_ROOM_COMMANDS,
  botTeamMentionOpen,
  type BotTeamComposerItem
} from '../../../../shared/bot-team-composer-menu'
import {
  removeBotTeamMentionBeforeCaret,
  type BotTeamMentionName
} from '../../../../shared/bot-team-mention-text'
import {
  BOT_TEAM_ROOM_ATTACHMENT_LIMIT,
  type BotTeamRoomAttachment
} from '../../../../shared/bot-team-room-attachments'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotTeamComposerMenu } from './BotTeamComposerMenu'
import { botTeamComposerChipAttrs } from './bot-team-composer-document'
import { useBotTeamComposerEditor } from './bot-team-composer-editor'
import { openBotTeamRoomSessions } from './open-bot-team-room-sessions'
import { useBotTeamFilePaths } from './use-bot-team-files'

const NO_TEAMS: readonly BotTeam[] = []

/** The files already picked, then the new ones not yet listed, up to the message's limit. */
function mergeAttachments(
  current: readonly BotTeamRoomAttachment[],
  added: readonly BotTeamRoomAttachment[]
): BotTeamRoomAttachment[] {
  const merged = [...current]
  for (const attachment of added) {
    if (!merged.some((entry) => entry.path === attachment.path)) {
      merged.push(attachment)
    }
  }
  return merged.slice(0, BOT_TEAM_ROOM_ATTACHMENT_LIMIT)
}

/** The room's message box with its @ and / menu; `onSend` resolves true once the host took the text. */
export function BotTeamRoomComposer({
  team,
  otherTeams = NO_TEAMS,
  offline,
  onSend,
  onAttachFiles
}: {
  team: BotTeam
  /** `@Name` of one of these sends the request to that team. */
  otherTeams?: readonly BotTeam[]
  offline: boolean
  onSend: (text: string, attachments: BotTeamRoomAttachment[]) => Promise<boolean>
  /** Picks files into the team folder; without it the room takes no files and the "+" stays hidden. */
  onAttachFiles?: () => Promise<BotTeamRoomAttachment[]>
}): React.JSX.Element {
  // The plain text the room sends (each picked mention as its "@Name") and the caret within it.
  const [text, setText] = useState('')
  const [caret, setCaret] = useState(0)
  const [menuIndex, setMenuIndex] = useState(0)
  const [menuDismissed, setMenuDismissed] = useState(false)
  const [pending, setPending] = useState<BotTeamRoomAttachment[]>([])
  const [attaching, setAttaching] = useState(false)
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
  const editor = useBotTeamComposerEditor({
    ariaLabel: translate('components.botTeams.messageTeam', 'Message the team'),
    placeholder: offline
      ? translate('components.botTeams.writeWhenBack', 'You can write again when this host is back')
      : translate(
          'components.botTeams.messageTeamHint',
          'Message the team, or type @ to ask one bot'
        ),
    disabled: offline,
    onChange: (current) => {
      setText(promptTextMap(current.state.doc).text)
      setCaret(promptTextOffset(current.state.doc, current.state.selection.from))
      setMenuIndex(0)
      setMenuDismissed(false)
    },
    onSelect: (current) =>
      setCaret(promptTextOffset(current.state.doc, current.state.selection.from))
  })
  // The ARIA links follow the open menu, so a screen reader reads the option the caret is on.
  useLayoutEffect(() => {
    const dom = editor?.view.dom
    if (!dom) {
      return
    }
    dom.setAttribute('aria-expanded', String(menu !== null))
    if (menu) {
      dom.setAttribute('aria-controls', menuId)
      dom.setAttribute('aria-activedescendant', `${menuId}-option-${menuIndex}`)
    } else {
      dom.removeAttribute('aria-controls')
      dom.removeAttribute('aria-activedescendant')
    }
  }, [editor, menu, menuId, menuIndex])
  const chooseMenuItem = (item: BotTeamComposerItem): void => {
    if (!menu || !editor) {
      return
    }
    if (item.kind === 'command') {
      editor.commands.clearContent(true)
      void openBotTeamRoomSessions()
      return
    }
    const chip = botTeamComposerChipAttrs(item)
    if (!chip) {
      return
    }
    // The typed "@query" is plain text, so the menu's character span maps onto document positions.
    const { positions } = promptTextMap(editor.state.doc)
    editor
      .chain()
      .focus()
      .insertContentAt({ from: positions[menu.start], to: positions[menu.end] }, [
        { type: 'botTeamMention', attrs: chip },
        { type: 'text', text: ' ' }
      ])
      .run()
    setMenuIndex(0)
  }
  const send = async (): Promise<void> => {
    if (!editor) {
      return
    }
    const sent = promptTextMap(editor.state.doc).text
    if (sent.trim() === '') {
      return
    }
    const snapshot = editor.getJSON()
    const files = pending
    // Clears at once, as Workspaces does; a refused send puts the text and files back unless more was added.
    editor.commands.clearContent(true)
    setPending([])
    if (!(await onSend(sent.trim(), files))) {
      if (editor.isEmpty) {
        editor.commands.setContent(snapshot, { emitUpdate: true })
      }
      setPending((current) => (current.length === 0 ? files : current))
    }
  }

  const attach = async (): Promise<void> => {
    if (!onAttachFiles || attaching) {
      return
    }
    setAttaching(true)
    try {
      const added = await onAttachFiles()
      setPending((current) => mergeAttachments(current, added))
    } finally {
      setAttaching(false)
    }
  }
  // Why: a picked mention is one atom, and a typed "@Name" is removed whole too, so Backspace takes it at once.
  const removeMentionBeforeCaret = (event: KeyboardEvent<HTMLElement>): boolean => {
    if (!editor || event.key !== 'Backspace' || event.nativeEvent.isComposing) {
      return false
    }
    const { selection, doc } = editor.state
    if (!selection.empty) {
      return false
    }
    const map = promptTextMap(doc)
    const next = removeBotTeamMentionBeforeCaret(
      map.text,
      promptTextOffset(doc, selection.from),
      mentionNames
    )
    if (!next) {
      return false
    }
    event.preventDefault()
    editor.view.dispatch(editor.state.tr.delete(map.positions[next.caret], selection.from))
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
      <div className="mx-auto max-w-[736px]">
        {pending.length > 0 ? (
          <ul
            aria-label={translate('components.botTeams.attachedFiles', 'Attached files')}
            className="mb-1.5 flex flex-wrap gap-1.5"
          >
            {pending.map((attachment) => (
              <li
                key={attachment.path}
                className="flex max-w-full items-center gap-1 rounded-md border border-input px-2 py-0.5 text-xs"
              >
                <span className="truncate">{attachment.name}</span>
                <button
                  type="button"
                  aria-label={translate(
                    'components.botTeams.removeAttachment',
                    'Remove attachment'
                  )}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setPending((current) =>
                      current.filter((entry) => entry.path !== attachment.path)
                    )
                  }
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="relative flex items-end gap-2 rounded-xl border border-input p-1.5">
          {menu ? (
            <BotTeamComposerMenu
              menu={menu}
              activeIndex={menuIndex}
              listboxId={menuId}
              onChoose={chooseMenuItem}
            />
          ) : null}
          {onAttachFiles ? (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full"
              aria-label={translate('components.botTeams.attachFiles', 'Attach files')}
              disabled={offline || attaching}
              onClick={() => void attach()}
            >
              <Plus className="size-4" />
            </Button>
          ) : null}
          <EditorContent
            editor={editor}
            className="scrollbar-sleek max-h-40 min-h-9 flex-1 overflow-y-auto px-2 py-1.5 text-sm"
            onKeyDownCapture={(event) => {
              if (imeEnterGesture.ownsKeyDown(event)) {
                return
              }
              // Shift+Enter is the newline the box takes; a plain Enter sends.
              if (event.key === 'Enter' && event.shiftKey && !imeEnterGesture.isComposing()) {
                event.preventDefault()
                editor?.commands.setHardBreak()
                return
              }
              if (!removeMentionBeforeCaret(event)) {
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
    </div>
  )
}
