import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import type { MarketplacePerform, RunMarketplaceAction } from './use-marketplace-app-action'

/** A dialog's submit: a failure stays inside the dialog, and success closes it. */
export function useFormSubmit(
  run: RunMarketplaceAction,
  onClose: () => void
): {
  pending: boolean
  error: string | null
  submit: (perform: MarketplacePerform) => Promise<void>
} {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (perform: MarketplacePerform): Promise<void> => {
    setPending(true)
    setError(null)
    const outcome = await run(perform)
    setPending(false)
    if (outcome.ok) {
      onClose()
    } else {
      setError(outcome.message)
    }
  }
  return { pending, error, submit }
}

/** One dialog for a Marketplace change: its fields, an inline failure, and Cancel beside the submit. */
export function MarketplaceFormDialog({
  title,
  description,
  submitLabel,
  destructive = false,
  disabled = false,
  pending,
  error,
  onSubmit,
  onClose,
  children
}: {
  title: string
  description: string
  submitLabel: string
  destructive?: boolean
  disabled?: boolean
  pending: boolean
  error: string | null
  onSubmit: () => void
  onClose: () => void
  children?: ReactNode
}): React.JSX.Element {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!disabled && !pending) {
              onSubmit()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children ? <div className="flex flex-col gap-3">{children}</div> : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {translate('auto.components.marketplace.MarketplaceFormDialog.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              variant={destructive ? 'destructive' : 'default'}
              disabled={disabled || pending}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TextField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  disabled = false
}: {
  id: string
  label: string
  type?: 'text' | 'url' | 'password'
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
