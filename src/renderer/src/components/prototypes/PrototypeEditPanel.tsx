import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { PrototypeSize } from '../../../../shared/prototype-draft'
import { FONT_SIZE_BOUNDS, sizeBoundsOf } from '../../../../shared/prototype-number-input'
import { PrototypeColorPicker } from './PrototypeColorPicker'
import {
  EDIT_INPUT_CLASS as INPUT_CLASS,
  EDIT_LABEL_CLASS as LABEL_CLASS,
  PrototypeUnitGroup
} from './PrototypeEditControls'
import { PrototypeNumberField } from './PrototypeNumberField'
import {
  FILL_COLOR_PALETTE,
  isHexColor,
  TEXT_COLOR_PALETTE
} from '../../../../shared/prototype-color'
import {
  closeSelection,
  editSelected,
  isReadOnlyView,
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
  const readOnly = isReadOnlyView(state)
  const note = noteFor(state)
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
    // Why: a half-typed hex belongs to one pin's field, so it never shows on another pin.
    const hexKey = `${state.view}:${pin.pinKey}:${field}`
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

      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {readOnly
          ? translate('components.prototypes.propertiesHeading', 'Properties · read-only')
          : translate('components.prototypes.editHeading', 'Edit')}
      </span>
      <fieldset disabled={readOnly} className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
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
                <PrototypeNumberField
                  key={`${state.view}:${pin.pinKey}:${field}`}
                  ariaLabel={
                    field === 'width'
                      ? translate('components.prototypes.widthValue', 'Width value')
                      : translate('components.prototypes.heightValue', 'Height value')
                  }
                  className={cn(INPUT_CLASS, 'w-14', dimmed && 'opacity-40')}
                  value={size.value}
                  bounds={sizeBoundsOf(size.unit)}
                  onCommit={(value) => setSize(field, { value, unit: size.unit })}
                />
                <PrototypeUnitGroup
                  label={
                    field === 'width'
                      ? translate('components.prototypes.widthUnit', 'Width unit')
                      : translate('components.prototypes.heightUnit', 'Height unit')
                  }
                  size={size}
                  onChange={(next) => setSize(field, next)}
                />
              </span>
            </div>
          )
        })}
        <label key={isPulsing('fontSize')} className={cn(LABEL_CLASS, pulseClass('fontSize'))}>
          {translate('components.prototypes.fontSizeLabel', 'Font size')}
          <span className="flex items-center gap-1.5">
            <PrototypeNumberField
              key={`${state.view}:${pin.pinKey}:fontSize`}
              className={cn(INPUT_CLASS, 'w-14')}
              value={pin.current.fontSize}
              bounds={FONT_SIZE_BOUNDS}
              onCommit={(fontSize) => update((latest) => editSelected(latest, { fontSize }))}
            />
            px
          </span>
        </label>
      </fieldset>

      {readOnly ? (
        note.trim().length > 0 ? (
          <div className="flex flex-col gap-1.5 px-0.5">
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {translate('components.prototypes.noteReadOnly', 'Note')}
            </span>
            <span className="text-[13px] leading-snug">{note}</span>
          </div>
        ) : null
      ) : (
        <div
          key={isPulsing('note')}
          className={cn('flex flex-col gap-1.5 px-0.5', pulseClass('note'))}
        >
          <label
            htmlFor="prototype-note"
            className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
          >
            {translate('components.prototypes.noteHeading', 'Note — anything Edit can’t do')}
          </label>
          <textarea
            id="prototype-note"
            rows={2}
            value={note}
            placeholder={translate(
              'components.prototypes.notePlaceholder',
              'Describe a change Edit can’t do: animation, behavior, style…'
            )}
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
      )}
      <span className="text-[11px] text-muted-foreground">
        {translate(
          'components.prototypes.editFooter',
          'Every change and note joins the draft on its own. Put a value back to remove it.'
        )}
      </span>
    </div>
  )
}
