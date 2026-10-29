import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { hslToHex, PICKER_HUES, pickerShadeCells } from '../../../../shared/prototype-color'

/** The custom color grid: hue row, shade cells, a preview with its hex, and Done. */
export function PrototypeColorPicker({
  field,
  value,
  hue,
  onHue,
  onPick,
  onDone
}: {
  field: 'color' | 'bg'
  value: string
  hue: number
  onHue: (hue: number) => void
  onPick: (hex: string) => void
  onDone: () => void
}): React.JSX.Element {
  const label =
    field === 'bg'
      ? translate('components.prototypes.pickerFillName', 'fill')
      : translate('components.prototypes.pickerTextColorName', 'text color')
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-popover p-2.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {translate('components.prototypes.customPicker', 'Custom {{label}}', { label })}
        </span>
        <span>{translate('components.prototypes.hueValue', 'hue {{deg}}°', { deg: hue })}</span>
      </div>
      <div
        role="group"
        aria-label={translate('components.prototypes.hueGroup', 'Hue')}
        className="flex gap-0.5"
      >
        {PICKER_HUES.map((deg) => (
          <button
            key={deg}
            type="button"
            aria-label={translate('components.prototypes.hueButton', 'Hue {{deg}}', { deg })}
            onClick={() => onHue(deg)}
            className={cn('h-4 flex-1 rounded-sm', hue === deg && 'ring-2 ring-ring')}
            style={{ background: hslToHex(deg, 85, 50) }}
          />
        ))}
      </div>
      <div
        role="group"
        aria-label={translate('components.prototypes.shadeGroup', 'Shade')}
        className="grid grid-cols-6 gap-1"
      >
        {pickerShadeCells(hue).map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={hex}
            onClick={() => onPick(hex)}
            className={cn(
              'h-[22px] rounded border border-border',
              value === hex && 'ring-2 ring-ring'
            )}
            style={{ background: hex }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span
          className="size-[22px] rounded-md border border-border"
          style={{ background: value }}
        />
        <span className="flex-1 font-mono text-xs">{value}</span>
        <button
          type="button"
          onClick={onDone}
          className="h-[26px] rounded-md border border-border px-2.5 text-xs hover:bg-accent"
        >
          {translate('components.prototypes.pickerDone', 'Done')}
        </button>
      </div>
    </div>
  )
}
