import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { removeDraftAdded } from '../../../../shared/prototype-design-system-draft'
import {
  addComponentToDraft,
  chooseAddChoice,
  DESIGN_SYSTEM_ADD_CHOICES,
  type DesignSystemViewState
} from '../../../../shared/prototype-design-system-view-state'
import { addChoiceLabel } from './prototype-design-system-labels'
import type { DesignSystemUpdate } from './prototype-design-system-props'

// The add panel above the grid, and the card of a component the draft adds.

export function AddComponentPanel({
  state,
  update
}: {
  state: DesignSystemViewState
  update: DesignSystemUpdate
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3">
      <span className="font-semibold">
        {translate('components.prototypes.designSystem.addTitle', 'Add a component')}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {DESIGN_SYSTEM_ADD_CHOICES.map((choice) => {
          const on = state.addChoice === choice && state.addText === ''
          return (
            <button
              key={choice}
              type="button"
              aria-pressed={on}
              onClick={() => update((latest) => chooseAddChoice(latest, choice))}
              className={cn(
                'h-7 rounded-full border border-border px-3 text-xs',
                on ? 'bg-foreground text-background' : 'text-foreground hover:bg-accent'
              )}
            >
              {addChoiceLabel(choice)}
            </button>
          )
        })}
      </div>
      <label htmlFor="design-system-add-custom" className="text-xs text-muted-foreground">
        {translate('components.prototypes.designSystem.customLabel', 'Or describe a custom one')}
      </label>
      <Input
        id="design-system-add-custom"
        value={state.addText}
        placeholder={translate(
          'components.prototypes.designSystem.customPlaceholder',
          'e.g. phase stepper with 3 steps and a status per step'
        )}
        onChange={(event) => {
          const text = event.target.value
          update((latest) => ({ ...latest, addText: text }))
        }}
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => update((latest) => ({ ...latest, addOpen: false }))}
        >
          {translate('components.prototypes.designSystem.cancel', 'Cancel')}
        </Button>
        <Button size="sm" onClick={() => update(addComponentToDraft)}>
          {translate('components.prototypes.designSystem.addToDraft', 'Add to draft')}
        </Button>
      </div>
    </div>
  )
}

export function AddedComponent({
  description,
  index,
  style,
  update
}: {
  description: string
  index: number
  /** The grid placement the Collage view gives it; absent in the other views. */
  style?: React.CSSProperties | undefined
  update: DesignSystemUpdate
}): React.JSX.Element {
  return (
    <div
      style={style}
      className="flex min-h-[120px] flex-col justify-center gap-1.5 rounded-xl border border-dashed border-border p-4"
    >
      <span className="font-mono text-xs">{description}</span>
      <span className="text-xs text-muted-foreground">
        {translate(
          'components.prototypes.designSystem.addedHint',
          'To be added by the agent · in the draft'
        )}
      </span>
      <Button
        variant="outline"
        size="xs"
        className="self-start"
        onClick={() =>
          update((latest) => ({ ...latest, draft: removeDraftAdded(latest.draft, index) }))
        }
      >
        {translate('components.prototypes.designSystem.undo', 'Undo')}
      </Button>
    </div>
  )
}
