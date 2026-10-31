import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronsLeftRight, ChevronsRightLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type {
  NativeChatVisualAnnotateEvent,
  NativeChatVisualAnnotateState,
  NativeChatVisualDesignReadout,
  NativeChatVisualNatural,
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
import { buildComponentFrameHtml } from '../../../../shared/prototype-design-system-preview'
import { collageColumnsOf, collageRowsOf } from '../../../../shared/prototype-design-system-collage'
import {
  DESIGN_ELEMENT_ROOT,
  designElementCss,
  elementLocatorOf,
  elementSelectorOf
} from '../../../../shared/prototype-design-system-element'
import type { DesignToken } from '../../../../shared/prototype-design-system-tokens'
import { joinParts } from '../../../../shared/prototype-design-system-view'
import type {
  DesignElementPick,
  DesignSystemSelection
} from '../../../../shared/prototype-design-system-view-state'
import type { DesignSystemUpdate } from './prototype-design-system-props'
import type { ComponentsView } from './prototype-design-system-view-mode'

// One component card: its caption, the component live in its frame, and the picks inside it.
type CardProps = {
  section: ComponentSection
  view: ComponentsView
  /** The width of the grid the cards sit in; a Collage card spans the columns its width needs. */
  gridWidth: number
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
export function ComponentCard({
  section,
  view,
  gridWidth,
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
  const articleRef = useRef<HTMLElement | null>(null)
  const [height, setHeight] = useState<number | null>(null)
  const [natural, setNatural] = useState<NativeChatVisualNatural | null>(null)
  useEffect(() => {
    const element = articleRef.current
    if (element === null) {
      return
    }
    const measure = (): void => setHeight(element.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
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
      selection: wholeSelection(section.name, natural?.root),
      pickerOpen: false
    }))
  const caption = joinParts([section.name, drafted.variants.join(' · ')], ' · ')
  const compact = view === 'grid' && !full
  return (
    <article
      ref={articleRef}
      style={
        view === 'collage'
          ? {
              gridColumn: `span ${collageColumnsOf(gridWidth, natural?.width ?? null)}`,
              gridRow: `span ${collageRowsOf(height)}`
            }
          : undefined
      }
      className={cn(
        'relative flex min-w-0 flex-col gap-2 rounded-xl border border-border p-3',
        selected && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
        removed && 'opacity-40',
        full && 'col-span-2'
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
          onNatural={setNatural}
          // Why: the chat visual's 80 px floor would pad a small component card.
          minHeight={0}
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
    return wholeSelection(name, element.design)
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

/** The whole component; its section's own readout rides along when known, so its Layout rows can edit. */
function wholeSelection(
  name: string,
  root: NativeChatVisualDesignReadout | undefined
): DesignSystemSelection {
  return root === undefined
    ? { kind: 'component', name }
    : {
        kind: 'component',
        name,
        element: { locator: DESIGN_ELEMENT_ROOT, label: name, readout: root, trail: [] }
      }
}
