import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { PrototypeSize } from '../../../../shared/prototype-draft'
import { PrototypeColorPicker } from './PrototypeColorPicker'
import {
  FILL_COLOR_PALETTE,
  isHexColor,
  TEXT_COLOR_PALETTE
} from '../../../../shared/prototype-color'
import {
  closeSelection,
  editSelected,
  isEditable,
  noteFor,
  selectedPinOf,
  setColorField,
  setHue,
  setNote,
  setPicker,
  type PrototypePicker,
  type PrototypeSetState
} from '../../../../shared/prototype-set-state'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void

const LABEL_CLASS =
  'grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2 px-0.5 py-0.5 text-xs text-muted-foreground'
const INPUT_CLASS = 'h-7 rounded-md border border-border bg-input px-2 text-xs text-foreground'
const UNIT_OPTIONS = ['px', '%', 'auto'] as const

/** The example notes: each one is written on the selected element. */
function noteChips(): readonly string[] {
  return [
    translate('components.prototypes.noteChipRainbow', 'Animated rainbow border'),
    translate('components.prototypes.noteChipShake', 'Shake on error'),
    translate('components.prototypes.noteChipGlass', 'Glassy, blurred background')
  ]
}

/** The selected pin: its heading, the Edit controls when the shown direction is iterated, and the note. */
export function PrototypeEditPanel({
  state,
  update,
  pulseField
}: {
  state: PrototypeSetState
  update: Update
  pulseField: string | null
}): React.JSX.Element | null {
  const pin = selectedPinOf(state)
  const [hexDraft, setHexDraft] = useState<Record<string, string>>({})
  if (pin === null) {
    return null
  }
  const editable = isEditable(state)
  const peeking = state.view !== state.active
  const noteHeading = peeking
    ? translate(
        'components.prototypes.noteHeadingPeek',
        'Note — what to take from {{view}} into {{active}}',
        {
          view: state.view,
          active: state.active
        }
      )
    : translate('components.prototypes.noteHeading', 'Note — anything Edit can’t do')
  const notePlaceholder = peeking
    ? translate(
        'components.prototypes.notePlaceholderPeek',
        'e.g. use this wallet button above the card form'
      )
    : translate(
        'components.prototypes.notePlaceholder',
        'Describe a change Edit can’t do: animation, behavior, style…'
      )
  const isPulsing = (field: string): string | undefined =>
    pulseField === field ? `${field}:${state.pulse?.nonce ?? 0}` : undefined
  const pulseClass = (field: string): string | false => pulseField === field && 'prototype-pulse'
  const textValue = pin.current.text
  const colorField: PrototypePicker = state.picker ?? 'color'

  const setSize = (field: 'width' | 'height', next: PrototypeSize): void =>
    update((current) => editSelected(current, { [field]: next }))

  const colorRow = (
    field: PrototypePicker,
    label: string,
    palette: readonly string[],
    rowField: string
  ): React.JSX.Element => {
    const current = field === 'color' ? pin.current.color : pin.current.bg
    const hexKey = `${field}`
    return (
      <div key={isPulsing(rowField)} className={cn(LABEL_CLASS, pulseClass(rowField))}>
        <span>{label}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          {palette.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={`${label} ${hex}`}
              onClick={() => update((latest) => setColorField(latest, field, hex))}
              className={cn(
                'size-[22px] rounded-md border border-border',
                current === hex && 'ring-2 ring-ring'
              )}
              style={{ background: hex }}
            />
          ))}
          <button
            type="button"
            aria-label={
              field === 'bg'
                ? translate('components.prototypes.customFill', 'Custom fill')
                : translate('components.prototypes.customTextColor', 'Custom text color')
            }
            onClick={() =>
              update((latest) => setPicker(latest, state.picker === field ? null : field))
            }
            className="size-[22px] rounded-md border border-border bg-[conic-gradient(#ef4444,#eab308,#22c55e,#06b6d4,#3b82f6,#a855f7,#ef4444)]"
          />
          <input
            aria-label={
              field === 'bg'
                ? translate('components.prototypes.fillHex', 'Fill hex')
                : translate('components.prototypes.textColorHex', 'Text color hex')
            }
            className={cn(INPUT_CLASS, 'w-[70px] font-mono')}
            value={hexDraft[hexKey] ?? current}
            onChange={(event) => {
              const next = event.target.value
              setHexDraft((draft) => ({ ...draft, [hexKey]: next }))
              if (isHexColor(next)) {
                update((latest) => setColorField(latest, field, next))
              }
            }}
          />
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 border-b border-border p-3">
      <div className="flex items-start justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold">
            {translate(
              'components.prototypes.selectionTitle',
              '{{letter}} · {{number}} · {{label}}',
              {
                letter: state.view,
                number: pin.number,
                label: pin.label
              }
            )}
          </span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {pin.selector}
          </span>
        </div>
        <button
          type="button"
          aria-label={translate('components.prototypes.close', 'Close')}
          onClick={() => update(closeSelection)}
          className="size-7 rounded-md text-base text-muted-foreground hover:bg-accent"
        >
          ×
        </button>
      </div>

      {editable ? (
        <>
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {translate('components.prototypes.editHeading', 'Edit')}
          </span>
          <label key={isPulsing('text')} className={cn(LABEL_CLASS, pulseClass('text'))}>
            {translate('components.prototypes.textLabel', 'Text')}
            <input
              className={INPUT_CLASS}
              value={textValue}
              onChange={(event) =>
                update((latest) => editSelected(latest, { text: event.target.value }))
              }
            />
          </label>
          {colorRow(
            'color',
            translate('components.prototypes.textColorLabel', 'Text color'),
            TEXT_COLOR_PALETTE,
            'color'
          )}
          {state.picker !== null ? (
            <PrototypeColorPicker
              field={colorField}
              value={colorField === 'bg' ? pin.current.bg : pin.current.color}
              hue={state.hue}
              onHue={(hue) => update((latest) => setHue(latest, hue))}
              onPick={(hex) => update((latest) => setColorField(latest, colorField, hex))}
              onDone={() => update((latest) => setPicker(latest, null))}
            />
          ) : null}
          {colorRow(
            'bg',
            translate('components.prototypes.fillLabel', 'Fill'),
            FILL_COLOR_PALETTE,
            'bg'
          )}
          {(['width', 'height'] as const).map((field) => {
            const size = pin.current[field]
            const dimmed = size.unit === 'auto'
            return (
              <div key={isPulsing(field)} className={cn(LABEL_CLASS, pulseClass(field))}>
                <span>
                  {field === 'width'
                    ? translate('components.prototypes.widthLabel', 'Width')
                    : translate('components.prototypes.heightLabel', 'Height')}
                </span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    aria-label={
                      field === 'width'
                        ? translate('components.prototypes.widthValue', 'Width value')
                        : translate('components.prototypes.heightValue', 'Height value')
                    }
                    className={cn(INPUT_CLASS, 'w-14', dimmed && 'opacity-40')}
                    value={size.value}
                    onChange={(event) =>
                      setSize(field, { value: Number(event.target.value), unit: size.unit })
                    }
                  />
                  <span
                    role="group"
                    className="flex rounded-md border border-border bg-sidebar p-0.5"
                  >
                    {UNIT_OPTIONS.map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        aria-pressed={size.unit === unit}
                        onClick={() => setSize(field, { value: size.value, unit })}
                        className={cn(
                          'h-[22px] rounded px-2 text-[11px]',
                          size.unit === unit
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        {unit}
                      </button>
                    ))}
                  </span>
                </span>
              </div>
            )
          })}
          <label key={isPulsing('fontSize')} className={cn(LABEL_CLASS, pulseClass('fontSize'))}>
            {translate('components.prototypes.fontSizeLabel', 'Font size')}
            <span className="flex items-center gap-1.5">
              <input
                type="number"
                className={cn(INPUT_CLASS, 'w-14')}
                value={pin.current.fontSize}
                onChange={(event) =>
                  update((latest) => editSelected(latest, { fontSize: Number(event.target.value) }))
                }
              />
              px
            </span>
          </label>
        </>
      ) : null}

      <div
        key={isPulsing('note')}
        className={cn('flex flex-col gap-1.5 px-0.5', pulseClass('note'))}
      >
        <label
          htmlFor="prototype-note"
          className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
        >
          {noteHeading}
        </label>
        <textarea
          id="prototype-note"
          rows={2}
          value={noteFor(state)}
          placeholder={notePlaceholder}
          onChange={(event) => update((latest) => setNote(latest, event.target.value))}
          className="resize-none rounded-md border border-border bg-input p-2 text-[13px] text-foreground"
        />
        <div className="flex flex-wrap gap-1.5">
          {noteChips().map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => update((latest) => setNote(latest, `${chip} on the ${pin.label}.`))}
              className="h-6 rounded-full border border-border px-2.5 text-[11px] hover:bg-accent"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
      <span className="text-[11px] text-muted-foreground">
        {translate(
          'components.prototypes.editFooter',
          'Every change and note joins the draft on its own. Put a value back to remove it.'
        )}
      </span>
    </div>
  )
}
