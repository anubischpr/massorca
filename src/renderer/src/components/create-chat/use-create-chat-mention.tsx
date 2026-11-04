import { useId, useState, type KeyboardEventHandler, type ReactNode, type RefObject } from 'react'
import { useAppStore } from '@/store'
import { NativeChatMentionMenu } from '../native-chat/NativeChatMentionMenu'
import {
  applyMentionSuggestion,
  deriveComposerAutocomplete,
  type ComposerAutocomplete
} from '../native-chat/native-chat-composer-state'
import { useNativeChatComposerKeyDown } from '../native-chat/use-native-chat-composer-keydown'
import { useNativeChatMentionFilesAndApps } from '../native-chat/use-native-chat-mention-apps'
import type { CreateChatSelection } from './create-chat-selection'

const CLOSED: ComposerAutocomplete = { mode: 'none' }

/** The worktree whose files @ lists: the picked one, else the project's main checkout; null with no project. */
export function useCreateChatMentionWorktreeId(selection: CreateChatSelection): string | null {
  const project = selection.project
  const mainWorktreeId = useAppStore((state) =>
    project.kind === 'repo'
      ? (state.worktreesByRepo[project.repoId]?.find((worktree) => worktree.isMainWorktree)?.id ??
        null)
      : null
  )
  if (selection.workspaceMode === 'existing-worktree' && selection.existingWorktreeId) {
    return selection.existingWorktreeId
  }
  return mainWorktreeId
}

/** The workspace chat's @ menu for a plain textarea: its files and apps, menu, keys and insertion. */
export function useCreateChatMention(args: {
  worktreeId: string | null
  draft: string
  setDraft: (draft: string) => void
  isComposing: () => boolean
  send: () => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
}): {
  menu: ReactNode
  /** The textarea's caret moved; the menu follows the token at it. */
  onCaret: (caret: number) => void
  onKeyDown: KeyboardEventHandler<HTMLElement>
  ariaProps: Record<string, string | boolean>
} {
  const { worktreeId, draft, setDraft, isComposing, send, textareaRef } = args
  const [caret, setCaret] = useState(0)
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const listboxId = useId()
  const derived =
    worktreeId === null ? CLOSED : deriveComposerAutocomplete(draft, caret, [], [], null, undefined)
  const autocomplete: ComposerAutocomplete =
    derived.mode === 'mention' && derived.triggerKey !== dismissed ? derived : CLOSED
  const mentionFiles = useNativeChatMentionFilesAndApps({
    query: autocomplete.mode === 'mention' ? autocomplete.query : null,
    terminalTabId: '',
    structuredWorktreeId: worktreeId ?? undefined
  })
  const completeMention = (path: string): void => {
    const next = applyMentionSuggestion(draft, caret, path)
    setDraft(next.draft)
    setCaret(next.caret)
    setActive(0)
    const textarea = textareaRef.current
    requestAnimationFrame(() => textarea?.setSelectionRange(next.caret, next.caret))
  }
  const onKeyDown = useNativeChatComposerKeyDown({
    autocomplete,
    mentionFiles,
    completeMention,
    activeSuggestion: active,
    draft,
    isComposing,
    completePickerItem: () => {},
    dispatchPickerCommand: () => {},
    dismissPicker: setDismissed,
    interrupt: () => {},
    send,
    setActiveSuggestion: setActive,
    setDraft: (value) => setDraft(typeof value === 'function' ? value(draft) : value),
    setCaret
  })
  const open = autocomplete.mode === 'mention'
  return {
    menu: open ? (
      <NativeChatMentionMenu
        mention={mentionFiles}
        activeIndex={active}
        listboxId={listboxId}
        placement="below"
        onChoose={completeMention}
      />
    ) : null,
    onCaret: (next) => {
      setCaret(next)
      setActive(0)
    },
    onKeyDown,
    ariaProps: open
      ? {
          'aria-expanded': true,
          'aria-controls': listboxId,
          'aria-activedescendant': `${listboxId}-option-${active}`
        }
      : { 'aria-expanded': false }
  }
}
