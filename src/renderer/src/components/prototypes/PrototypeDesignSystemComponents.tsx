import { useMemo, useRef, useState } from 'react'
import { ChevronsLeftRight, ChevronsRightLeft, Columns3, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type {
  NativeChatVisualAnnotateEvent,
  NativeChatVisualAnnotateState,
  NativeChatVisualOverride,
  NativeChatVisualPickedElement
} from '../../../../shared/native-chat-visual-annotate'
import { NativeChatVisualFrame } from '../native-chat/NativeChatVisualFrame'
import type { ComponentSection } from '../../../../shared/prototype-design-system-components'
import {
  draftComponentState,
  draftElementsOf,
  toggleDraftRemoved,
  type DesignSystemDraft
} from '../../../../shared/prototype-design-system-draft'
import { DESIGN_SYSTEM_COMPONENTS_PATH } from '../../../../shared/prototype-design-system-files'
import { buildComponentFrameHtml } from '../../../../shared/prototype-design-system-preview'
import {
  designElementCss,
  DESIGN_ELEMENT_ROOT,
  elementLocatorOf,
  elementSelectorOf
} from '../../../../shared/prototype-design-system-element'
import type { DesignToken } from '../../../../shared/prototype-design-system-tokens'
import { joinParts } from '../../../../shared/prototype-design-system-view'
import {
  effectiveSelectionOf,
  type DesignElementPick,
  type DesignSystemSelection,
} from '../../../../shared/prototype-design-system-view-state'
import { AddComponentPanel, AddedComponent } from './PrototypeDesignSystemAddComponent'
import { keyedEntries } from './prototype-entry-keys'
import type { DesignSystemPanelProps, DesignSystemUpdate } from './prototype-design-system-props'
import {
  readComponentsView,
  writeComponentsView,
  type ComponentsView
} from './prototype-design-system-view-mode'

/**
 * The Components tab: the count, the view switch and the add panel, then each component rendered live from
 * its file with the draft applied, and the components the draft adds.
 */
export function PrototypeDesignSystemComponents({
  content,
  state,
  update
}: DesignSystemPanelProps): React.JSX.Element {
  const selected = effectiveSelectionOf(state, content.components)
  const selectedName = selected?.kind === 'component' ? selected.name : null
  const [view, setView] = useState<ComponentsView>(readComponentsView)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const chooseView = (next: ComponentsView): void => {
    setView(next)
    writeComponentsView(next)
  }
  const toggleAdd = (): void => update((latest) => ({ ...latest, addOpen: !latest.addOpen }))
  const itemClass = view === 'collage' ? 'mb-4 break-inside-avoid' : ''
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="mr-auto min-w-0 text-xs text-muted-foreground">
          {translate(
            'components.prototypes.designSystem.componentCount',
            '{{count}} components · rendered from {{path}} with the current tokens',
            { count: content.components.length, path: DESIGN_SYSTEM_COMPONENTS_PATH }
          )}
        </span>
        <ViewSwitch view={view} onChoose={chooseView} />
        <Button variant="outline" size="sm" onClick={toggleAdd}>
          {translate('components.prototypes.designSystem.addComponent', '+ Add component')}
        </Button>
      </div>
      {state.addOpen ? <AddComponentPanel state={state} update={update} /> : null}
      <div
        className={cn(
          view === 'grid' && 'grid grid-cols-2 content-start gap-4',
          view === 'collage' && 'columns-2 gap-4',
          view === 'list' && 'flex flex-col gap-4'
        )}
      >
        {content.components.map((section) => (
          <ComponentCard
            key={section.name}
            section={section}
            view={view}
            itemClass={itemClass}
            full={expanded.has(section.name)}
            onToggleFull={() =>
              setExpanded((current) => {
                const next = new Set(current)
                if (next.has(section.name)) {
                  next.delete(section.name)
                } else {
                  next.add(section.name)
                }
                return next
              })
            }
            draft={state.draft}
            tokens={content.tokens}
            styleBlock={content.styleBlock}
            selected={selectedName === section.name}
            pickedLocator={
              selected?.kind === 'component' && selected.name === section.name
                ? (selected.element?.locator ?? null)
                : null
            }
            update={update}
          />
        ))}
        {keyedEntries(state.draft.added, (description) => description).map(
          ({ key, entry: description, index }) => (
            <AddedComponent
              key={key}
              description={description}
              index={index}
              itemClass={itemClass}
              update={update}
            />
          )
        )}
      </div>
    </div>
  )
}

const VIEW_ICONS = { grid: LayoutGrid, collage: Columns3, list: List } as const

function ViewSwitch({
  view,
  onChoose
}: {
  view: ComponentsView
  onChoose: (view: ComponentsView) => void
}): React.JSX.Element {
  const labels: Record<ComponentsView, string> = {
    grid: translate('components.prototypes.designSystem.viewGrid', 'Grid'),
    collage: translate('components.prototypes.designSystem.viewCollage', 'Collage'),
    list: translate('components.prototypes.designSystem.viewList', 'List')
  }
  return (
    <span
      role="group"
      aria-label={translate('components.prototypes.designSystem.viewGroup', 'Component view')}
      className="flex rounded-md border border-border p-0.5"
    >
      {(Object.keys(VIEW_ICONS) as ComponentsView[]).map((option) => {
        const Icon = VIEW_ICONS[option]
        return (
          <button
            key={option}
            type="button"
            aria-label={labels[option]}
            aria-pressed={view === option}
            title={labels[option]}
            onClick={() => onChoose(option)}
            className={cn(
              'grid h-[26px] min-w-[30px] place-items-center rounded',
              view === option
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent'
            )}
          >
            <Icon className="size-[15px]" aria-hidden="true" />
          </button>
        )
      })}
    </span>
  )
}

type CardProps = {
  section: ComponentSection
  view: ComponentsView
  itemClass: string
  full: boolean
  onToggleFull: () => void
  draft: DesignSystemDraft
  tokens: readonly DesignToken[]
  styleBlock: string
  selected: boolean
  /** The locator of the element picked inside this component, when one is. */
  pickedLocator: string | null
  update: DesignSystemUpdate
}

// A component card: its caption, the component live in a strict frame, and the picks inside it. A click on
// the card's own padding or caption selects the whole component; a component the draft removes is dimmed.
function ComponentCard({
  section,
  view,
  itemClass,
  full,
  onToggleFull,
  draft,
  tokens,
  styleBlock,
  selected,
  pickedLocator,
  update
}: CardProps): React.JSX.Element {
  const scopeRef = useRef<HTMLDivElement | null>(null)
  const drafted = draftComponentState(draft, section)
  const removed = draft.removed[section.name] === true
  const html = buildComponentFrameHtml(tokens, draft.values, styleBlock, section, drafted.bindings)
  const annotate = useMemo<NativeChatVisualAnnotateState>(
    () => ({
      enabled: true,
      pins:
        pickedLocator === null || pickedLocator === DESIGN_ELEMENT_ROOT
          ? []
          : [
              {
                pinKey: 'selected',
                number: 1,
                selector: elementSelectorOf(pickedLocator),
                active: true,
                badge: false
              }
            ],
      overrides: overridesOf(draft, section, tokens)
    }),
    [draft, section, tokens, pickedLocator]
  )
  const onAnnotateEvent = (event: NativeChatVisualAnnotateEvent): void => {
    if (event.kind !== 'element-picked') {
      return
    }
    const pick = pickFromAnnotate(section.name, event.element)
    if (pick === null) {
      return
    }
    update((latest) => ({ ...latest, pickerOpen: false, selection: pick }))
  }
  const selectWhole = (): void =>
    update((latest) => ({
      ...latest,
      selection: { kind: 'component', name: section.name },
      pickerOpen: false
    }))
  const caption = joinParts([section.name, drafted.variants.join(' · ')], ' · ')
  const compact = view === 'grid' && !full
  return (
    <article
      className={cn(
        'relative flex min-w-0 flex-col gap-2 rounded-xl border border-border p-3',
        selected && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
        removed && 'opacity-40',
        full && 'col-span-2',
        itemClass
      )}
      onClick={selectWhole}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={translate(
            'components.prototypes.designSystem.selectComponent',
            'Select {{name}}',
            { name: section.name }
          )}
          aria-pressed={selected}
          onClick={(event) => {
            event.stopPropagation()
            selectWhole()
          }}
          className="mr-auto min-w-0 truncate text-left font-mono text-[11px] text-muted-foreground"
        >
          {caption}
        </button>
        {view === 'grid' ? (
          <button
            type="button"
            aria-label={
              full
                ? translate(
                    'components.prototypes.designSystem.compactSize',
                    'Back to compact size'
                  )
                : translate('components.prototypes.designSystem.fullSize', 'View full size')
            }
            title={
              full
                ? translate(
                    'components.prototypes.designSystem.compactSize',
                    'Back to compact size'
                  )
                : translate('components.prototypes.designSystem.fullSize', 'View full size')
            }
            onClick={(event) => {
              event.stopPropagation()
              onToggleFull()
            }}
            className="grid size-[26px] place-items-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {full ? (
              <ChevronsRightLeft className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronsLeftRight className="size-3.5" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      <div ref={scopeRef} className={cn('flex w-full min-w-0', compact ? 'h-[132px]' : '')}>
        <NativeChatVisualFrame
          document={{ revision: section.name, html }}
          title={section.name}
          layout={compact ? 'panel' : 'inline'}
          themeScope={scopeRef}
          onRetired={() => undefined}
          annotate={annotate}
          onAnnotateEvent={onAnnotateEvent}
          strictScripts
        />
      </div>
      {removed ? (
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground"
          onClick={(event) => event.stopPropagation()}
        >
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
    </article>
  )
}

/** The css of each element the draft edits, as the overrides the frame applies live. */
function overridesOf(
  draft: DesignSystemDraft,
  section: ComponentSection,
  tokens: readonly DesignToken[]
): NativeChatVisualOverride[] {
  return Object.entries(draftElementsOf(draft, section)).flatMap(([locator, entry]) => {
    const css = designElementCss(entry.edits, tokens)
    return Object.keys(css).length === 0
      ? []
      : [{ selector: elementSelectorOf(locator), style: { css } }]
  })
}

/**
 * The selection a pick makes: the whole component for the section, else the element with its ancestors.
 * Null for a pick the host cannot place, so the selection stays where it was.
 */
function pickFromAnnotate(
  name: string,
  element: NativeChatVisualPickedElement
): DesignSystemSelection | null {
  const locator = elementLocatorOf(element.selector)
  if (locator === null || element.design === undefined) {
    return null
  }
  if (locator === DESIGN_ELEMENT_ROOT) {
    return { kind: 'component', name }
  }
  const trail: DesignElementPick['trail'] = (element.trail ?? []).flatMap((item) => {
    const itemLocator = elementLocatorOf(item.selector)
    return itemLocator === null
      ? []
      : [{ locator: itemLocator, label: item.label, readout: item.design }]
  })
  return {
    kind: 'component',
    name,
    element: { locator, label: element.label, readout: element.design, trail }
  }
}
