import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { ComponentSection } from '../../../../shared/prototype-design-system-components'
import {
  draftComponentState,
  draftTokenValue,
  setDraftBinding,
  setDraftNote,
  setDraftTokenValue,
  setDraftVariants,
  toggleDraftRemoved
} from '../../../../shared/prototype-design-system-draft'
import type { DesignToken } from '../../../../shared/prototype-design-system-tokens'
import { componentsUsingToken, tokenGroupOf } from '../../../../shared/prototype-design-system-view'
import { effectiveSelectionOf } from '../../../../shared/prototype-design-system-view-state'
import { isHexColor, pickerHueOf } from '../../../../shared/prototype-color'
import { PrototypeColorPicker } from './PrototypeColorPicker'
import type { DesignSystemPanelProps } from './prototype-design-system-props'

/** The aside's selection block: the chosen token's value, or the chosen component's edits. */
export function PrototypeDesignSystemSelection(
  props: DesignSystemPanelProps
): React.JSX.Element | null {
  const selection = effectiveSelectionOf(props.state, props.content.components)
  if (selection === null) {
    return null
  }
  if (selection.kind === 'token') {
    const token = props.content.tokens.find((candidate) => candidate.id === selection.id)
    return token === undefined ? null : <TokenEditor {...props} token={token} />
  }
  const section = props.content.components.find((candidate) => candidate.name === selection.name)
  return section === undefined ? null : <ComponentEditor {...props} section={section} />
}

// A token: its id, the components and sets that use it, its value, and the note that changes preview on their own.
function TokenEditor({
  token,
  content,
  state,
  update,
  rebuildSets
}: DesignSystemPanelProps & { token: DesignToken }): React.JSX.Element {
  const value = draftTokenValue(state.draft, token)
  const setValue = (text: string): void => {
    update((latest) => ({ ...latest, draft: setDraftTokenValue(latest.draft, token, text) }))
  }
  return (
    <div className="flex flex-col gap-2.5 border-b border-border p-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono font-semibold">{token.id}</span>
        <span className="text-xs text-muted-foreground">
          {translate(
            'components.prototypes.designSystem.usedBy',
            'Used by {{components}} components · {{sets}} sets',
            {
              components: componentsUsingToken(token.id, content.components),
              sets: rebuildSets.length
            }
          )}
        </span>
      </div>
      {token.group === 'color' ? (
        <ColorValue
          key={token.id}
          token={token}
          value={value}
          pickerOpen={state.pickerOpen}
          pickerHue={state.pickerHue}
          update={update}
          commit={setValue}
        />
      ) : (
        <label className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2 text-xs text-muted-foreground">
          {translate('components.prototypes.designSystem.valueLabel', 'Value')}
          <input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-7 w-20 rounded-md border border-border bg-input px-2 font-mono text-xs text-foreground"
          />
        </label>
      )}
      <span className="text-[11px] text-muted-foreground">
        {translate(
          'components.prototypes.designSystem.changesPreview',
          'Changes preview on Components and join the draft on their own.'
        )}
      </span>
    </div>
  )
}

// A color value: the original and the draft swatches, the custom swatch that opens the picker, and a hex field
// that takes only a complete hex color.
function ColorValue({
  token,
  value,
  pickerOpen,
  pickerHue,
  update,
  commit
}: {
  token: DesignToken
  value: string
  pickerOpen: boolean
  pickerHue: number
  update: DesignSystemPanelProps['update']
  commit: (text: string) => void
}): React.JSX.Element {
  const [typed, setTyped] = useState<string | null>(null)
  const swatches = [...new Set([token.value, value])]
  const choose = (hex: string): void => {
    setTyped(null)
    commit(hex)
  }
  return (
    <>
      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2 text-xs text-muted-foreground">
        <span>{translate('components.prototypes.designSystem.valueLabel', 'Value')}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          {swatches.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={translate(
                'components.prototypes.designSystem.swatchLabel',
                'Color {{hex}}',
                {
                  hex
                }
              )}
              onClick={() => choose(hex)}
              className={cn(
                'size-[22px] rounded-md border border-border',
                hex === value && 'ring-2 ring-ring'
              )}
              style={{ background: hex }}
            />
          ))}
          <button
            type="button"
            aria-label={translate('components.prototypes.designSystem.customColor', 'Custom color')}
            aria-pressed={pickerOpen}
            onClick={() =>
              update((latest) => ({
                ...latest,
                pickerOpen: !latest.pickerOpen,
                pickerHue: pickerHueOf(value)
              }))
            }
            className="size-[22px] rounded-md border border-border bg-[conic-gradient(#ef4444,#eab308,#22c55e,#06b6d4,#3b82f6,#a855f7,#ef4444)]"
          />
          <input
            type="text"
            aria-label={translate('components.prototypes.designSystem.hexLabel', 'Hex')}
            value={typed ?? value}
            onChange={(event) => {
              const text = event.target.value
              setTyped(text)
              if (isHexColor(text)) {
                commit(text)
              }
            }}
            onBlur={() => setTyped(null)}
            className="h-[26px] w-20 rounded-md border border-border bg-input px-1.5 font-mono text-[11px] text-foreground"
          />
        </span>
      </div>
      {pickerOpen ? (
        <PrototypeColorPicker
          field="token"
          value={value}
          hue={pickerHue}
          onHue={(hue) => update((latest) => ({ ...latest, pickerHue: hue }))}
          onPick={choose}
          onDone={() => update((latest) => ({ ...latest, pickerOpen: false }))}
        />
      ) : null}
    </>
  )
}

// A component: its name and the sets that use it, its variant chips, its token bindings, its note and its removal.
function ComponentEditor({
  section,
  content,
  state,
  update,
  rebuildSets
}: DesignSystemPanelProps & { section: ComponentSection }): React.JSX.Element {
  const drafted = draftComponentState(state.draft, section)
  const removed = state.draft.removed[section.name] === true
  const note = state.draft.notes[section.name] ?? ''
  const toggleVariant = (variant: string): void => {
    update((latest) => {
      const current = draftComponentState(latest.draft, section).variants
      const next = current.includes(variant)
        ? current.filter((entry) => entry !== variant)
        : [...current, variant]
      return { ...latest, draft: setDraftVariants(latest.draft, section, next) }
    })
  }
  return (
    <div className="flex flex-col gap-2.5 border-b border-border p-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{section.name}</span>
        <span className="text-xs text-muted-foreground">
          {translate(
            'components.prototypes.designSystem.componentUsedIn',
            'used in {{sets}} sets',
            {
              sets: rebuildSets.length
            }
          )}
        </span>
      </div>
      {section.variantOptions.length === 0 ? null : (
        <>
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {translate(
              'components.prototypes.designSystem.editVariants',
              'Edit · variants and states'
            )}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {section.variantOptions.map((variant) => {
              const on = drafted.variants.includes(variant)
              return (
                <button
                  key={variant}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleVariant(variant)}
                  className={cn(
                    'h-[26px] rounded-full border border-border px-2.5 text-xs',
                    on ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                  )}
                >
                  {variant}
                </button>
              )
            })}
          </div>
        </>
      )}
      {Object.keys(section.bindings).length === 0 ? null : (
        <>
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {translate('components.prototypes.designSystem.editBindings', 'Edit · token bindings')}
          </span>
          {Object.entries(section.bindings).map(([prop, tokenId]) => {
            const bound = drafted.bindings[prop] ?? tokenId
            const options = content.tokens.filter((token) => token.group === tokenGroupOf(tokenId))
            return (
              <div
                key={prop}
                className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2 text-xs text-muted-foreground"
              >
                <span>{prop}</span>
                <span className="flex flex-wrap gap-1">
                  {options.map((option) => {
                    const on = bound === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          update((latest) => ({
                            ...latest,
                            draft: setDraftBinding(latest.draft, section, prop, option.id)
                          }))
                        }
                        className={cn(
                          'h-6 rounded-md border border-border px-2 font-mono text-[11px]',
                          on ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {option.id}
                      </button>
                    )
                  })}
                </span>
              </div>
            )
          })}
        </>
      )}
      <label
        htmlFor="design-system-component-note"
        className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
      >
        {translate('components.prototypes.designSystem.noteLabel', 'Note — anything Edit can’t do')}
      </label>
      <textarea
        id="design-system-component-note"
        rows={2}
        value={note}
        placeholder={translate(
          'components.prototypes.designSystem.notePlaceholder',
          'Describe a change: behavior, animation, structure…'
        )}
        onChange={(event) => {
          const text = event.target.value
          update((latest) => ({
            ...latest,
            draft: setDraftNote(latest.draft, section.name, text)
          }))
        }}
        className="resize-none rounded-md border border-border bg-input p-2 text-[13px] text-foreground"
      />
      <button
        type="button"
        onClick={() =>
          update((latest) => ({
            ...latest,
            draft: toggleDraftRemoved(latest.draft, section.name)
          }))
        }
        className="h-7 self-start rounded-lg border border-destructive/50 px-3 text-xs text-destructive hover:bg-accent"
      >
        {removed
          ? translate('components.prototypes.designSystem.undoRemove', 'Undo remove')
          : translate('components.prototypes.designSystem.removeComponent', 'Remove component')}
      </button>
    </div>
  )
}
