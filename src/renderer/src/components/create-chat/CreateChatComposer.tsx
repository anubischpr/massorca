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
  /** Location, project and workspace mode: the row attached above the box. */
  placeChips: ReactNode
  /** The box footer, left: Permissions and the session view switch. */
  footerChips: ReactNode
  /** Below the box: what the chosen session view leaves out, or why it cannot open. */
  notice: ReactNode
  rightChips: ReactNode
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
      <div
        role="group"
        aria-label={translate('components.createChat.placeAria', 'Where it runs')}
        className="relative mx-3 -mb-1.5 flex items-center gap-0.5 rounded-t-xl border border-b-0 border-border bg-card px-1.5 pt-1 pb-2"
      >
        <fieldset disabled={pending} className="contents">
          {placeChips}
        </fieldset>
      </div>
      <div className="relative rounded-xl border border-border bg-card shadow-xs transition-[box-shadow] focus-within:ring-1 focus-within:ring-ring/50">
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
      {notice}
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
