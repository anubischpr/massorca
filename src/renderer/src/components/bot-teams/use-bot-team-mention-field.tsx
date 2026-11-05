import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject
} from 'react'
import { EditorContent, type Editor } from '@tiptap/react'
import { useImeEnterGestureOwnership } from '@/lib/ime-composition-keyboard-event'
import { useNativeChatComposerKeyDown } from '../native-chat/use-native-chat-composer-keydown'
import { promptTextMap, promptTextOffset } from '../native-chat/native-chat-prompt-document'
import {
  botTeamComposerMenu,
  botTeamMentionOpen,
  type BotTeamComposerItem,
  type BotTeamMentionProject,
  type BotTeamRoomCommand
} from '../../../../shared/bot-team-composer-menu'
import {
  removeBotTeamMentionBeforeCaret,
  type BotTeamMentionName
} from '../../../../shared/bot-team-mention-text'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { useConnectedMarketplaceApps } from '../marketplace/use-connected-marketplace-apps'
import { BotTeamComposerMenu } from './BotTeamComposerMenu'
import { botTeamComposerChipAttrs } from './bot-team-composer-document'
import { useBotTeamComposerEditor } from './bot-team-composer-editor'
import { whenBotTeamEditorMounted } from './bot-team-editor-mount'
import { useBotTeamFilePaths } from './use-bot-team-files'

/** How far PageUp and PageDown move the highlight in the open @ or / menu. */
const MENU_PAGE_STEP = 10

/** The item a page key lands on, clamped to the menu's ends; null for other keys. */
function pagedMenuIndex(index: number, count: number, key: string): number | null {
  if (key !== 'PageDown' && key !== 'PageUp') {
    return null
  }
  const step = key === 'PageDown' ? MENU_PAGE_STEP : -MENU_PAGE_STEP
  return Math.min(Math.max(index + step, 0), count - 1)
}

/**
 * The room's message field: its TipTap box, the @ and / menu over it and the keys, shared by the
 * conference room and the Tasks home's Bot Team mode. `text` is what it sends, each chip as "@Name".
 */
export function useBotTeamMentionField(args: {
  team: BotTeam
  otherTeams: readonly BotTeam[]
  projects: readonly BotTeamMentionProject[]
  commands?: readonly BotTeamRoomCommand[]
  offline: boolean
  /** Where the menu opens; the room's box sits at the bottom, so above. */
  menuPlacement?: 'above' | 'below'
  ariaLabel: string
  placeholder: string
  send: () => void
  /** A picked command runs here; the box is already cleared. */
  onCommand?: (item: Extract<BotTeamComposerItem, { kind: 'command' }>) => void
}): {
  editor: Editor | null
  text: string
  /** Wraps the box and its menu: a click outside closes the menu. */
  containerRef: RefObject<HTMLDivElement | null>
  menu: React.JSX.Element | null
  field: (className: string) => React.JSX.Element
} {
  const { team, otherTeams, projects, commands, offline, send, onCommand } = args
  const [text, setText] = useState('')
  const [caret, setCaret] = useState(0)
  const [menuIndex, setMenuIndex] = useState(0)
  const [menuDismissed, setMenuDismissed] = useState(false)
  const menuId = useId()
  const files = useBotTeamFilePaths(team.id, !offline && botTeamMentionOpen(text, caret))
  // Why: the menu is team-wide while a mention targets one bot, so only an app no bot may use is hidden.
  const apps = useConnectedMarketplaceApps(team)
  const mentionNames = useMemo<BotTeamMentionName[]>(
    () => [
      ...team.bots.map((bot) => ({ name: bot.name, kind: 'bot' as const })),
      ...otherTeams.map((entry) => ({ name: entry.name, kind: 'team' as const })),
      ...projects.map((entry) => ({ name: entry.name, kind: 'project' as const })),
      ...apps.map((app) => ({ name: app.name, kind: 'app' as const }))
    ],
    [team.bots, otherTeams, projects, apps]
  )
  const menu =
    menuDismissed || offline
      ? null
      : botTeamComposerMenu({
          text,
          caret,
          bots: team.bots,
          teams: otherTeams,
          projects,
          files,
          apps,
          commands
        })
  const editor = useBotTeamComposerEditor({
    ariaLabel: args.ariaLabel,
    placeholder: args.placeholder,
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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const menuOpen = menu !== null
  // Why: a click anywhere outside the box closes its @ and / menu, as it closes a popover.
  useEffect(() => {
    if (!menuOpen) {
      return
    }
    const onPointerDown = (event: PointerEvent): void => {
      const inside = event.target instanceof Node && containerRef.current?.contains(event.target)
      if (!inside) {
        setMenuDismissed(true)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen])
  // The ARIA links follow the open menu, so a screen reader reads the option the caret is on.
  useLayoutEffect(() => {
    if (!editor) {
      return
    }
    return whenBotTeamEditorMounted(editor, (dom) => {
      dom.setAttribute('aria-expanded', String(menu !== null))
      if (menu) {
        dom.setAttribute('aria-controls', menuId)
        dom.setAttribute('aria-activedescendant', `${menuId}-option-${menuIndex}`)
      } else {
        dom.removeAttribute('aria-controls')
        dom.removeAttribute('aria-activedescendant')
      }
    })
  }, [editor, menu, menuId, menuIndex])
  const chooseMenuItem = (item: BotTeamComposerItem): void => {
    if (!menu || !editor) {
      return
    }
    if (item.kind === 'command') {
      editor.commands.clearContent(true)
      onCommand?.(item)
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
    send,
    setActiveSuggestion: setMenuIndex,
    setDraft: setText,
    setCaret
  })

  return {
    editor,
    text,
    containerRef,
    menu: menu ? (
      <BotTeamComposerMenu
        menu={menu}
        activeIndex={menuIndex}
        listboxId={menuId}
        placement={args.menuPlacement}
        onChoose={chooseMenuItem}
      />
    ) : null,
    field: (className) => (
      <EditorContent
        editor={editor}
        className={className}
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
          const paged = menu ? pagedMenuIndex(menuIndex, menu.items.length, event.key) : null
          if (paged !== null && !imeEnterGesture.isComposing()) {
            event.preventDefault()
            setMenuIndex(paged)
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
    )
  }
}
