import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { ArrowUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useImeEnterGestureOwnership } from '@/lib/ime-composition-keyboard-event'
import { NativeChatPromptEditor } from '../native-chat/NativeChatPromptEditor'
import type { NativeChatComposerInput } from '../native-chat/native-chat-composer-input'
import { CreateChatChipMenuGroup } from './CreateChatChipMenu'
import { useCreateChatMention } from './use-create-chat-mention'

/** Wording that differs when another page, such as the Tasks home's Bot Team mode, reuses the box. */
export type CreateChatComposerCopy = {
  placeholder: string
  placeAria: string
  sendAria: string
  creatingAria: string
  creating: string
  hint: string
}

type CreateChatComposerProps = {
  draft: string
  onDraftChange: (draft: string) => void
  canSubmit: boolean
  /** The launch is running: the chips are inert and the send shows progress. */
  pending: boolean
  error: string | null
  onSubmit: () => void
  /** Location, project and workspace mode: the row attached above the box. */
  placeChips: ReactNode
  /** The box footer, left: Permissions and the session view switch. */
  footerChips: ReactNode
  /** Below the box: what the chosen session view leaves out, or why it cannot open. */
  notice: ReactNode
  rightChips: ReactNode
  /** Defaults to the session wording. */
  copy?: CreateChatComposerCopy
  /** The worktree whose files `@` lists, as the workspace chat does; null or absent offers none. */
  mentionWorktreeId?: string | null
  /** A field that replaces the textarea, with its own `@` menu (the Tasks home's Bot Team mode). */
  editorField?: {
    render: (className: string) => ReactNode
    menu: ReactNode
    containerRef: RefObject<HTMLDivElement | null>
  }
}

/** The first-message box: the place row above it, the text, footer chips, send, any launch error and the hint. */
export function CreateChatComposer({
  draft,
  onDraftChange,
  canSubmit,
  pending,
  error,
  onSubmit,
  placeChips,
  footerChips,
  notice,
  rightChips,
  copy,
  mentionWorktreeId,
  editorField
}: CreateChatComposerProps): React.JSX.Element {
  const placeholder =
    copy?.placeholder ??
    translate(
      'components.createChat.composerPlaceholder',
      'Describe the task to start the session…'
    )
  const inputRef = useRef<NativeChatComposerInput | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const imeEnterGesture = useImeEnterGestureOwnership()
  const mention = useCreateChatMention({
    worktreeId: editorField ? null : (mentionWorktreeId ?? null),
    draft,
    setDraft: onDraftChange,
    isComposing: imeEnterGesture.isComposing,
    send: () => {
      if (canSubmit) {
        onSubmit()
      }
    },
    inputRef,
    boxRef
  })
  // A draft set from outside, such as cleared after the launch, reaches the editor here.
  useLayoutEffect(() => {
    const input = inputRef.current
    if (input && input.value !== draft) {
      input.value = draft
    }
  }, [draft])
  // The editor fixes its attributes when it is created, so the menu's combobox state is set here.
  useLayoutEffect(() => {
    const field = boxRef.current?.querySelector('[role="textbox"]')
    if (!field) {
      return
    }
    field.removeAttribute('aria-controls')
    field.removeAttribute('aria-activedescendant')
    field.setAttribute('aria-label', placeholder)
    for (const [name, value] of Object.entries(mention.ariaProps)) {
      field.setAttribute(name, value)
    }
  })
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (imeEnterGesture.ownsKeyDown(event)) {
      return
    }
    if (mention.menu) {
      mention.onKeyDown(event)
      return
    }
    // Why: Shift+Enter keeps the editor's newline; a plain Enter creates the session.
    if (event.key !== 'Enter' || event.shiftKey || imeEnterGesture.isComposing()) {
      return
    }
    event.preventDefault()
    if (canSubmit) {
      onSubmit()
    }
  }

  return (
    <CreateChatChipMenuGroup>
      <div className="flex w-full flex-col gap-2">
        <div
          role="group"
          aria-label={
            copy?.placeAria ?? translate('components.createChat.placeAria', 'Where it runs')
          }
          className="relative mx-3 -mb-1.5 flex items-center gap-0.5 rounded-t-xl border border-b-0 border-border bg-card px-1.5 pt-1 pb-2"
        >
          <fieldset disabled={pending} className="contents">
            {placeChips}
          </fieldset>
        </div>
        <div
          ref={(element) => {
            boxRef.current = element
            if (editorField) {
              editorField.containerRef.current = element
            }
          }}
          className="relative rounded-xl border border-border bg-card shadow-xs transition-[box-shadow] focus-within:ring-1 focus-within:ring-ring/50"
        >
          {editorField ? editorField.menu : mention.menu}
          {editorField ? (
            editorField.render(
              'scrollbar-sleek block max-h-60 min-h-20 w-full overflow-y-auto rounded-xl px-4 pt-3 pb-1 text-sm'
            )
          ) : (
            <NativeChatPromptEditor
              inputRef={inputRef}
              initialValue={draft}
              disabled={false}
              placeholder={placeholder}
              onChange={(input) => {
                onDraftChange(input.value)
                mention.onCaret(input.selectionStart ?? input.value.length)
              }}
              onSelect={(input) => mention.onCaret(input.selectionStart ?? 0)}
              onKeyDownCapture={handleKeyDown}
              onKeyUp={imeEnterGesture.onKeyUp}
              onCompositionStart={() => imeEnterGesture.setComposing(true)}
              onCompositionEnd={imeEnterGesture.onCompositionEnd}
              onBlur={imeEnterGesture.reset}
              className="scrollbar-sleek block max-h-60 min-h-20 w-full overflow-y-auto rounded-xl px-4 pt-3 pb-1 text-sm outline-none"
            />
          )}
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <fieldset disabled={pending} className="contents">
                {footerChips}
              </fieldset>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <fieldset disabled={pending} className="contents">
                {rightChips}
              </fieldset>
              <Button
                type="button"
                size="icon-sm"
                aria-label={
                  pending
                    ? (copy?.creatingAria ??
                      translate('components.createChat.creatingAria', 'Creating session'))
                    : (copy?.sendAria ??
                      translate('components.createChat.sendAria', 'Create session'))
                }
                disabled={!canSubmit}
                onClick={onSubmit}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
        {notice}
        {error ? (
          <p role="alert" className="text-center text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <p className="text-center text-xs text-muted-foreground">
          {pending
            ? (copy?.creating ?? translate('components.createChat.creating', 'Creating session…'))
            : (copy?.hint ??
              translate(
                'components.createChat.composerHint',
                'Enter to create the session · Shift+Enter for a new line'
              ))}
        </p>
      </div>
    </CreateChatChipMenuGroup>
  )
}
