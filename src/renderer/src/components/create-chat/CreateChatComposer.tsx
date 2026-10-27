import type { KeyboardEvent, ReactNode } from 'react'
import { ArrowUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { ImeTextarea } from '@/lib/ime-text-field'

type CreateChatComposerProps = {
  draft: string
  onDraftChange: (draft: string) => void
  canSubmit: boolean
  /** The launch is running: the chips are inert and the send shows progress. */
  pending: boolean
  error: string | null
  onSubmit: () => void
  leftChips: ReactNode
  rightChips: ReactNode
}

/** The first-message box: text, the footer chips, the send button, any launch error and the keyboard hint. */
export function CreateChatComposer({
  draft,
  onDraftChange,
  canSubmit,
  pending,
  error,
  onSubmit,
  leftChips,
  rightChips
}: CreateChatComposerProps): React.JSX.Element {
  const placeholder = translate(
    'components.createChat.composerPlaceholder',
    'Describe the task to start the session…'
  )
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Why: Shift+Enter keeps the newline; IME composition is filtered by ImeTextarea before this runs.
    if (event.key !== 'Enter' || event.shiftKey) {
      return
    }
    event.preventDefault()
    if (canSubmit) {
      onSubmit()
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="rounded-xl border border-border bg-card shadow-xs transition-[box-shadow] focus-within:ring-1 focus-within:ring-ring/50">
        <ImeTextarea
          rows={3}
          value={draft}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className="block max-h-60 min-h-20 w-full resize-none rounded-xl bg-transparent px-4 pt-3 pb-1 text-sm outline-none placeholder:text-muted-foreground/60"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex min-w-0 flex-wrap items-center gap-0.5">
            <fieldset disabled={pending} className="contents">
              {leftChips}
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
                  ? translate('components.createChat.creatingAria', 'Creating session')
                  : translate('components.createChat.sendAria', 'Create session')
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
      {error ? (
        <p role="alert" className="text-center text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <p className="text-center text-xs text-muted-foreground">
        {pending
          ? translate('components.createChat.creating', 'Creating session…')
          : translate(
              'components.createChat.composerHint',
              'Enter to create the session · Shift+Enter for a new line'
            )}
      </p>
    </div>
  )
}
