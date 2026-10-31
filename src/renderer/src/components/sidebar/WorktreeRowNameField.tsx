import { useId, type RefObject } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import { isImeOwnedKeyboardEvent } from '@/lib/ime-composition-keyboard-event'

type WorktreeRowNameFieldProps = {
  disabled: boolean
  inputRef: RefObject<HTMLInputElement | null>
  onEnter: () => void | Promise<void>
  onValueChange: (value: string) => void
  value: string
}

/** The name the one-line row shows for this workspace. It never renames the git branch. */
export function WorktreeRowNameField({
  disabled,
  inputRef,
  onEnter,
  onValueChange,
  value
}: WorktreeRowNameFieldProps): React.JSX.Element {
  const inputId = useId()

  return (
    <div className="space-y-1">
      <Label htmlFor={inputId}>{translate('workspace.links.rowName', 'Row name')}</Label>
      <Input
        id={inputId}
        ref={inputRef}
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || isImeOwnedKeyboardEvent(event)) {
            return
          }
          event.preventDefault()
          void onEnter()
        }}
      />
      <p className="text-xs text-muted-foreground">
        {translate(
          'workspace.links.rowNameHelp',
          'Shown on the one-line row. The git branch is not renamed.'
        )}
      </p>
    </div>
  )
}
