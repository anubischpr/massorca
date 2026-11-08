import {
  useId,
  useMemo,
  useState,
  type KeyboardEventHandler,
  type ReactNode,
  type RefObject
} from 'react'
import { useAppStore } from '@/store'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import { createChatPrimaryWorktree } from './create-chat-primary-worktree'
import { NativeChatMentionMenu } from '../native-chat/NativeChatMentionMenu'
import type { NativeChatComposerInput } from '../native-chat/native-chat-composer-input'
import {
  applyMentionSuggestion,
  deriveComposerAutocomplete,
  type ComposerAutocomplete
} from '../native-chat/native-chat-composer-state'
import { useNativeChatComposerKeyDown } from '../native-chat/use-native-chat-composer-keydown'
import {
  nativeChatMentionChip,
  useNativeChatMentionFilesAndApps
} from '../native-chat/use-native-chat-mention-apps'
import type { NativeChatMentionProject } from '../native-chat/use-native-chat-mention-files'
import {
  reposOnHost,
  type CreateChatRepoOption,
  type CreateChatSelection
} from './create-chat-selection'

const CLOSED: ComposerAutocomplete = { mode: 'none' }
/** The menu's tallest height (`max-h-72`) plus its gap and a margin from the window edge. */
const MENU_ROOM = 288 + 12

/** Below the box when the menu fits there, else above when there is more room above. */
export function createChatMentionPlacement(
  box: Pick<DOMRect, 'top' | 'bottom'>,
  viewportHeight: number
): 'above' | 'below' {
  const roomBelow = viewportHeight - box.bottom
  return roomBelow < MENU_ROOM && box.top > roomBelow ? 'above' : 'below'
}

/** Where @ lists files: a worktree on the host the user picked, and its folder when known. */
export type CreateChatMentionTarget = {
  /** Null for a projectless chat, which has no files to list and offers `projects` instead. */
  worktreeId: string | null
  executionHostId: ExecutionHostId
  rootPath: string | null
  projects?: readonly NativeChatMentionProject[]
}

/** The picked worktree, else the project's primary checkout as the submit resolves it; a projectless chat names the host's projects. */
export function useCreateChatMentionTarget(
  selection: CreateChatSelection,
  repos: readonly CreateChatRepoOption[]
): CreateChatMentionTarget | null {
  const { project, executionHostId } = selection
  const repoId = project.kind === 'repo' ? project.repoId : null
  const projectless = useMemo<CreateChatMentionTarget>(
    () => ({
      worktreeId: null,
      executionHostId,
      rootPath: null,
      projects: reposOnHost(repos, executionHostId).map((repo) => ({
        name: repo.displayName,
        path: repo.path
      }))
    }),
    [executionHostId, repos]
  )
  const repo = useAppStore((state) =>
    repoId === null ? null : (state.repos.find((entry) => entry.id === repoId) ?? null)
  )
  const worktrees = useAppStore((state) =>
    repoId === null ? null : (state.worktreesByRepo[repoId] ?? null)
  )
  return useMemo(() => {
    if (repoId === null) {
      return projectless
    }
    const picked =
      selection.workspaceMode === 'existing-worktree' ? selection.existingWorktreeId : undefined
    if (picked) {
      const row = worktrees?.find((worktree) => worktree.id === picked)
      return { worktreeId: picked, executionHostId, rootPath: row?.path ?? null }
    }
    if (!repo) {
      return null
    }
    const primary = createChatPrimaryWorktree({ repoId, path: repo.path }, worktrees ?? [])
    return { worktreeId: primary.id, executionHostId, rootPath: primary.path }
  }, [
    executionHostId,
    projectless,
    repo,
    repoId,
    selection.existingWorktreeId,
    selection.workspaceMode,
    worktrees
  ])
}

/** The workspace chat's @ menu for the first-message box: its files and apps, menu, keys and chips. */
export function useCreateChatMention(args: {
  target: CreateChatMentionTarget | null
  draft: string
  setDraft: (draft: string) => void
  isComposing: () => boolean
  send: () => void
  inputRef: RefObject<NativeChatComposerInput | null>
  /** The box the menu hangs from; its room below decides which side the menu opens on. */
  boxRef: RefObject<HTMLElement | null>
}): {
  menu: ReactNode
  /** The caret moved; the menu follows the token at it. */
  onCaret: (caret: number) => void
  onKeyDown: KeyboardEventHandler<HTMLElement>
  /** The combobox attributes the box's text field carries while the menu is open. */
  ariaProps: Record<string, string>
} {
  const { target, draft, setDraft, isComposing, send, inputRef, boxRef } = args
  const [caret, setCaret] = useState(0)
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [placement, setPlacement] = useState<'above' | 'below'>('below')
  const listboxId = useId()
  const derived =
    target === null ? CLOSED : deriveComposerAutocomplete(draft, caret, [], [], null, undefined)
  const autocomplete: ComposerAutocomplete =
    derived.mode === 'mention' && derived.triggerKey !== dismissed ? derived : CLOSED
  const mentionFiles = useNativeChatMentionFilesAndApps({
    query: autocomplete.mode === 'mention' ? autocomplete.query : null,
    terminalTabId: '',
    structuredWorktreeId: target?.worktreeId ?? undefined,
    executionHostId: target?.executionHostId,
    rootPath: target?.rootPath,
    listFiles: target?.worktreeId != null,
    projects: target?.projects
  })
  const completeMention = (path: string): void => {
    const next = applyMentionSuggestion(draft, caret, path)
    const input = inputRef.current
    if (next.draft !== draft && input?.insertMention) {
      const chip = nativeChatMentionChip(path, mentionFiles)
      input.insertMention(next.caret - chip.token.length - 1, caret, chip)
    }
    setDraft(next.draft)
    setCaret(next.caret)
    setActive(0)
    requestAnimationFrame(() => input?.setSelectionRange(next.caret, next.caret))
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
        placement={placement}
        onChoose={completeMention}
      />
    ) : null,
    onCaret: (next) => {
      setCaret(next)
      setActive(0)
      const box = boxRef.current
      if (box) {
        setPlacement(createChatMentionPlacement(box.getBoundingClientRect(), window.innerHeight))
      }
    },
    onKeyDown,
    ariaProps: open
      ? {
          'aria-expanded': 'true',
          'aria-controls': listboxId,
          'aria-activedescendant': `${listboxId}-option-${active}`
        }
      : { 'aria-expanded': 'false' }
  }
}
