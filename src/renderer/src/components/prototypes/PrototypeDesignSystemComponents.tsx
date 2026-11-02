import { useEffect, useRef, useState } from 'react'
import { Columns3, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { DESIGN_SYSTEM_COMPONENTS_PATH } from '../../../../shared/prototype-design-system-files'
import { collageColumnsOf, collageRowsOf } from '../../../../shared/prototype-design-system-collage'
import { effectiveSelectionOf } from '../../../../shared/prototype-design-system-view-state'
import { AddComponentPanel, AddedComponent } from './PrototypeDesignSystemAddComponent'
import { ComponentCard } from './PrototypeDesignSystemCard'
import { keyedEntries } from './prototype-entry-keys'
import type { DesignSystemPanelProps } from './prototype-design-system-props'
import {
  COMPONENTS_VIEWS,
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
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [gridWidth, setGridWidth] = useState(0)
  useEffect(() => {
    const element = gridRef.current
    if (element === null) {
      return
    }
    const measure = (): void => setGridWidth(element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
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
        ref={gridRef}
        className={cn(
          view === 'grid' && 'grid grid-cols-2 content-start gap-4',
          view === 'collage' && 'grid grid-cols-6 items-start gap-3 grid-flow-dense',
          view === 'list' && 'flex flex-col gap-4'
        )}
      >
        {content.components.map((section) => (
          <ComponentCard
            key={section.name}
            section={section}
            view={view}
            gridWidth={gridWidth}
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
              style={
                view === 'collage'
                  ? {
                      gridColumn: `span ${collageColumnsOf(gridWidth, null)}`,
                      gridRow: `span ${collageRowsOf(120)}`
                    }
                  : undefined
              }
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
      {COMPONENTS_VIEWS.map((option) => {
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
