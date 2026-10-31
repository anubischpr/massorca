import { cn } from '@/lib/utils'
import type { PrototypeSize } from '../../../../shared/prototype-draft'
import { clampToBounds, sizeBoundsOf } from '../../../../shared/prototype-number-input'

/** The row, label and input classes the Annotate edit panel and the Design system aside share. */
export const EDIT_LABEL_CLASS =
  'grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2 px-0.5 py-0.5 text-xs text-muted-foreground'
export const EDIT_INPUT_CLASS =
  'h-7 rounded-md border border-border bg-input px-2 text-xs text-foreground'

/**
 * The px, % and auto group beside a size field. Picking a unit keeps the value inside that unit's
 * bounds, so the field never shows a size its unit cannot hold.
 */
export function PrototypeUnitGroup({
  label,
  size,
  onChange
}: {
  label: string
  size: PrototypeSize
  onChange: (size: PrototypeSize) => void
}): React.JSX.Element {
  return (
    <span
      role="group"
      aria-label={label}
      className="flex rounded-md border border-border bg-sidebar p-0.5"
    >
      {(['px', '%', 'auto'] as const).map((unit) => (
        <button
          key={unit}
          type="button"
          aria-pressed={size.unit === unit}
          onClick={() => onChange({ value: clampToBounds(size.value, sizeBoundsOf(unit)), unit })}
          className={cn(
            'h-[22px] rounded px-2 text-[11px]',
            size.unit === unit ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
          )}
        >
          {unit}
        </button>
      ))}
    </span>
  )
}
