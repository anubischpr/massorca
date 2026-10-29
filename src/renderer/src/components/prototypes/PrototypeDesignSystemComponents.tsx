import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { ComponentSection } from '../../../../shared/prototype-design-system-components'
import {
  draftComponentState,
  removeDraftAdded,
  toggleDraftRemoved,
  type DesignSystemDraft
} from '../../../../shared/prototype-design-system-draft'
import { DESIGN_SYSTEM_COMPONENTS_PATH } from '../../../../shared/prototype-design-system-files'
import { buildComponentPreviewDocument } from '../../../../shared/prototype-design-system-preview'
import type { DesignToken } from '../../../../shared/prototype-design-system-tokens'
import { joinParts } from '../../../../shared/prototype-design-system-view'
import {
  addComponentToDraft,
  chooseAddChoice,
  DESIGN_SYSTEM_ADD_CHOICES,
  effectiveSelectionOf,
  type DesignSystemViewState
} from '../../../../shared/prototype-design-system-view-state'
import { addChoiceLabel } from './prototype-design-system-labels'
import type { DesignSystemPanelProps, DesignSystemUpdate } from './prototype-design-system-props'

/**
 * The Components tab: the count and the add panel, each component rendered from its file with the draft's
 * values, and the components the draft adds.
 */
export function PrototypeDesignSystemComponents({
  content,
  state,
  update
}: DesignSystemPanelProps): React.JSX.Element {
  const selected = effectiveSelectionOf(state, content.components)
  const selectedName = selected?.kind === 'component' ? selected.name : null
  const toggleAdd = (): void => update((latest) => ({ ...latest, addOpen: !latest.addOpen }))
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <div className="flex items-center gap-2.5">
        <span className="mr-auto text-xs text-muted-foreground">
          {translate(
            'components.prototypes.designSystem.componentCount',
            '{{count}} components · rendered from {{path}} with the current tokens',
            { count: content.components.length, path: DESIGN_SYSTEM_COMPONENTS_PATH }
          )}
        </span>
        <Button variant="outline" size="sm" onClick={toggleAdd}>
          {translate('components.prototypes.designSystem.addComponent', '+ Add component')}
        </Button>
      </div>
      {state.addOpen ? <AddComponentPanel state={state} update={update} /> : null}
      <div className="grid grid-cols-2 content-start gap-4">
        {content.components.map((section) => (
          <ComponentCard
            key={section.name}
            section={section}
            draft={state.draft}
            tokens={content.tokens}
            styleBlock={content.styleBlock}
            selected={selectedName === section.name}
            update={update}
          />
        ))}
        {state.draft.added.map((description, index) => (
          <AddedComponent
            key={`${index}:${description}`}
            description={description}
            index={index}
            update={update}
          />
        ))}
      </div>
    </div>
  )
}

type CardProps = {
  section: ComponentSection
  draft: DesignSystemDraft
  tokens: readonly DesignToken[]
  styleBlock: string
  selected: boolean
  update: DesignSystemUpdate
}

// A component card: its caption, the component in a script-less sandboxed frame, and a select control over the
// whole card. A component the draft removes is dimmed and carries its Undo.
function ComponentCard({
  section,
  draft,
  tokens,
  styleBlock,
  selected,
  update
}: CardProps): React.JSX.Element {
  const drafted = draftComponentState(draft, section)
  const removed = draft.removed[section.name] === true
  const preview = buildComponentPreviewDocument(
    tokens,
    draft.values,
    styleBlock,
    section,
    drafted.bindings
  )
  const caption = joinParts([section.name, drafted.variants.join(' · ')], ' · ')
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          'relative flex flex-col gap-2 rounded-xl border border-border p-3',
          selected && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
          removed && 'opacity-40'
        )}
      >
        <span className="font-mono text-[11px] text-muted-foreground">{caption}</span>
        <iframe
          title={section.name}
          sandbox=""
          srcDoc={preview}
          tabIndex={-1}
          className="h-[132px] w-full rounded-md border-0"
        />
        <button
          type="button"
          aria-label={translate(
            'components.prototypes.designSystem.selectComponent',
            'Select {{name}}',
            {
              name: section.name
            }
          )}
          aria-pressed={selected}
          onClick={() =>
            update((latest) => ({
              ...latest,
              selection: { kind: 'component', name: section.name },
              pickerOpen: false
            }))
          }
          className="absolute inset-0 rounded-xl"
        />
      </div>
      {removed ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {translate(
              'components.prototypes.designSystem.removedHint',
              'Marked for removal · in the draft'
            )}
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() =>
              update((latest) => ({
                ...latest,
                draft: toggleDraftRemoved(latest.draft, section.name)
              }))
            }
          >
            {translate('components.prototypes.designSystem.undo', 'Undo')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function AddComponentPanel({
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

function AddedComponent({
  description,
  index,
  update
}: {
  description: string
  index: number
  update: DesignSystemUpdate
}): React.JSX.Element {
  return (
    <div className="flex min-h-[120px] flex-col justify-center gap-1.5 rounded-xl border border-dashed border-border p-4">
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
