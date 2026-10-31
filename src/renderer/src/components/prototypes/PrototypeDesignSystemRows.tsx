import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { PrototypeSize } from '../../../../shared/prototype-draft'
import { isHexColor, pickerHueOf } from '../../../../shared/prototype-color'
import { sizeBoundsOf, type NumberBounds } from '../../../../shared/prototype-number-input'
import type { DesignToken } from '../../../../shared/prototype-design-system-tokens'
import { PrototypeColorPicker } from './PrototypeColorPicker'
import { EDIT_INPUT_CLASS, EDIT_LABEL_CLASS, PrototypeUnitGroup } from './PrototypeEditControls'
import { PrototypeNumberField } from './PrototypeNumberField'

/** Chips shown before `+N more`; the bound token is kept among them when the list collapses. */
export const COLLAPSED_TOKEN_COUNT = 4

/**
 * The tokens a row shows: the first four when collapsed, with the bound token always among them; all of
 * them when open.
 */
export function collapsedTokens<Token extends { id: string }>(
  tokens: readonly Token[],
  bound: string,
  open: boolean
): readonly Token[] {
  if (open || tokens.length <= COLLAPSED_TOKEN_COUNT) {
    return tokens
  }
  const first = tokens.slice(0, COLLAPSED_TOKEN_COUNT)
  const boundToken = tokens.find((token) => token.id === bound)
  if (boundToken === undefined || first.includes(boundToken)) {
    return first
  }
  return [boundToken, ...first.slice(0, COLLAPSED_TOKEN_COUNT - 1)]
}

/** The label of an aside row, in its translated words. */
export function rowLabelOf(row: string): string {
  switch (row) {
    case 'fill':
      return translate('components.prototypes.designSystem.row.fill', 'Fill')
    case 'color':
      return translate('components.prototypes.designSystem.row.color', 'Text color')
    case 'border':
      return translate('components.prototypes.designSystem.row.border', 'Border')
    case 'borderWidth':
      return translate('components.prototypes.designSystem.row.borderWidth', 'Border width')
    case 'radius':
      return translate('components.prototypes.designSystem.row.radius', 'Radius')
    case 'shadow':
      return translate('components.prototypes.designSystem.row.shadow', 'Shadow')
    case 'width':
      return translate('components.prototypes.widthLabel', 'Width')
    case 'height':
      return translate('components.prototypes.heightLabel', 'Height')
    case 'padding':
      return translate('components.prototypes.designSystem.row.padding', 'Padding')
    case 'gap':
      return translate('components.prototypes.designSystem.row.gap', 'Gap')
    case 'font':
      return translate('components.prototypes.designSystem.row.font', 'Font')
    case 'fontSize':
      return translate('components.prototypes.fontSizeLabel', 'Font size')
    case 'lineHeight':
      return translate('components.prototypes.designSystem.row.lineHeight', 'Line height')
    case 'style':
      return translate('components.prototypes.designSystem.row.style', 'Style')
    default:
      return translate('components.prototypes.designSystem.row.align', 'Align')
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={EDIT_LABEL_CLASS}>
      <span>{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

/**
 * A row bound to a token group: the chips, `+N more` to open them, and for a color row the custom swatch
 * and its hex field. A value that no chip holds shows only in the hex field or the number.
 */
export function TokenChipRow({
  label,
  tokens,
  value,
  onPick,
  customColor
}: {
  label: string
  tokens: readonly DesignToken[]
  /** The token id, or a raw hex or px the row holds without a token. */
  value: string
  onPick: (tokenId: string) => void
  /** Given for a color row: the hex of the value, and the commit of a typed or picked hex. */
  customColor?: { hex: string; onHex: (hex: string) => void }
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [hue, setHue] = useState(0)
  const [typed, setTyped] = useState<string | null>(null)
  const shown = collapsedTokens(tokens, value, open)
  const isColor = customColor !== undefined
  return (
    <>
      <Row label={label}>
        {tokens.length === 0 ? (
          <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
            {value}
          </span>
        ) : null}
        {shown.map((token) => (
          <button
            key={token.id}
            type="button"
            aria-pressed={token.id === value}
            title={token.id}
            onClick={() => onPick(token.id)}
            className={cn(
              'flex h-6 max-w-full items-center gap-1.5 truncate rounded-md border border-border px-2 font-mono text-[11px]',
              token.id === value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
            )}
          >
            {isColor ? (
              <i
                className="size-2.5 rounded-sm border border-border"
                style={{ background: token.value }}
              />
            ) : null}
            {token.id}
          </button>
        ))}
        {tokens.length > COLLAPSED_TOKEN_COUNT ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            className="h-6 rounded-md border border-dashed border-border px-2 font-mono text-[11px] text-muted-foreground"
          >
            {open
              ? translate('components.prototypes.designSystem.showLess', 'Show less')
              : translate('components.prototypes.designSystem.moreTokens', '+{{count}} more', {
                  count: tokens.length - COLLAPSED_TOKEN_COUNT
                })}
          </button>
        ) : null}
        {customColor === undefined ? null : (
          <>
            <button
              type="button"
              aria-label={translate(
                'components.prototypes.designSystem.customColor',
                'Custom color'
              )}
              aria-pressed={picking}
              onClick={() => {
                setHue(pickerHueOf(customColor.hex))
                setPicking((current) => !current)
              }}
              className="size-[22px] rounded-md border border-border bg-[conic-gradient(#ef4444,#eab308,#22c55e,#06b6d4,#3b82f6,#a855f7,#ef4444)]"
            />
            <input
              type="text"
              aria-label={translate('components.prototypes.designSystem.hexLabel', 'Hex')}
              value={typed ?? customColor.hex}
              onChange={(event) => {
                const text = event.target.value
                setTyped(text)
                if (isHexColor(text)) {
                  customColor.onHex(text)
                }
              }}
              onBlur={() => setTyped(null)}
              className="h-[26px] w-20 rounded-md border border-border bg-input px-1.5 font-mono text-[11px] text-foreground"
            />
          </>
        )}
      </Row>
      {picking && customColor !== undefined ? (
        <PrototypeColorPicker
          field="token"
          value={customColor.hex}
          hue={hue}
          onHue={setHue}
          onPick={customColor.onHex}
          onDone={() => setPicking(false)}
        />
      ) : null}
    </>
  )
}

/** A number row: a number in its bounds, with the unit written after it when there is one. */
export function NumberRow({
  label,
  ariaLabel,
  value,
  bounds,
  unit,
  onCommit
}: {
  label: string
  ariaLabel: string
  value: number
  bounds: NumberBounds
  unit?: string
  onCommit: (value: number) => void
}): React.JSX.Element {
  return (
    <Row label={label}>
      <PrototypeNumberField
        ariaLabel={ariaLabel}
        className={cn(EDIT_INPUT_CLASS, 'w-14')}
        value={value}
        bounds={bounds}
        onCommit={onCommit}
      />
      {unit === undefined ? null : <span className="text-xs text-muted-foreground">{unit}</span>}
    </Row>
  )
}

/** A size row: the number of the size, and its px, % or auto unit. Auto shows its number dimmed. */
export function SizeRow({
  label,
  ariaLabel,
  unitLabel,
  size,
  onCommit
}: {
  label: string
  ariaLabel: string
  unitLabel: string
  size: PrototypeSize
  onCommit: (size: PrototypeSize) => void
}): React.JSX.Element {
  return (
    <Row label={label}>
      <PrototypeNumberField
        ariaLabel={ariaLabel}
        className={cn(EDIT_INPUT_CLASS, 'w-14', size.unit === 'auto' && 'opacity-40')}
        value={size.value}
        bounds={sizeBoundsOf(size.unit)}
        onCommit={(value) => onCommit({ value, unit: size.unit })}
      />
      <PrototypeUnitGroup label={unitLabel} size={size} onChange={onCommit} />
    </Row>
  )
}

/** The B, I and U flags of a text row. */
export function StyleRow({
  bold,
  italic,
  underline,
  onToggle
}: {
  bold: boolean
  italic: boolean
  underline: boolean
  onToggle: (flag: 'bold' | 'italic' | 'underline') => void
}): React.JSX.Element {
  const flags = [
    {
      flag: 'bold',
      on: bold,
      label: translate('components.prototypes.designSystem.bold', 'Bold'),
      glyph: <b>B</b>
    },
    {
      flag: 'italic',
      on: italic,
      label: translate('components.prototypes.designSystem.italic', 'Italic'),
      glyph: <i>I</i>
    },
    {
      flag: 'underline',
      on: underline,
      label: translate('components.prototypes.designSystem.underline', 'Underline'),
      glyph: <u>U</u>
    }
  ] as const
  return (
    <Row label={rowLabelOf('style')}>
      <span
        role="group"
        aria-label={rowLabelOf('style')}
        className="flex rounded-md border border-border bg-sidebar p-0.5"
      >
        {flags.map((entry) => (
          <button
            key={entry.flag}
            type="button"
            aria-label={entry.label}
            aria-pressed={entry.on}
            onClick={() => onToggle(entry.flag)}
            className={cn(
              'h-[22px] min-w-6 rounded px-1.5 text-[11px]',
              entry.on ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
            )}
          >
            {entry.glyph}
          </button>
        ))}
      </span>
    </Row>
  )
}

const ALIGNS = ['left', 'center', 'right'] as const

/** The text alignment of a text row: left, center or right. */
export function AlignRow({
  align,
  onPick
}: {
  align: string
  onPick: (align: (typeof ALIGNS)[number]) => void
}): React.JSX.Element {
  return (
    <Row label={rowLabelOf('align')}>
      <span
        role="group"
        aria-label={rowLabelOf('align')}
        className="flex rounded-md border border-border bg-sidebar p-0.5"
      >
        {ALIGNS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={align === option}
            onClick={() => onPick(option)}
            className={cn(
              'h-[22px] rounded px-2 text-[11px]',
              align === option ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
            )}
          >
            {option}
          </button>
        ))}
      </span>
    </Row>
  )
}
