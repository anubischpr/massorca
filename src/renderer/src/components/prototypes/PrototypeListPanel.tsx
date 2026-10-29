import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { PrototypeListGroup } from '../../../../shared/prototype-list-groups'
import {
  PROTOTYPE_FILTERS,
  type PrototypeFilter,
  type PrototypeListRow
} from '../../../../shared/prototype-list-model'
import { joinParts } from '../../../../shared/prototype-design-system-view'
import type { PrototypeListedDesignSystem } from '../../../../shared/rpc-contract/prototype-params'
import {
  prototypeAgentLabel,
  prototypeBuiltOnLabel,
  prototypeFilterLabel,
  prototypeStatusLabel,
  prototypeSystemLine
} from './prototype-labels'

/**
 * The left column: the heading, the agent filter, and one group per project: its name, its design system
 * row, then its sets, newest first.
 */
export function PrototypeListPanel({
  groups,
  filter,
  onFilter,
  selectedRequestId,
  selectedProjectKey,
  onSelect,
  onSelectSystem
}: {
  groups: readonly PrototypeListGroup[]
  filter: PrototypeFilter
  onFilter: (filter: PrototypeFilter) => void
  selectedRequestId: string | null
  selectedProjectKey: string | null
  onSelect: (requestId: string) => void
  onSelectSystem: (projectKey: string) => void
}): React.JSX.Element {
  return (
    <section
      aria-label={translate('components.prototypes.listLabel', 'All prototypes')}
      className="flex min-h-0 w-[250px] shrink-0 flex-col"
    >
      <div className="flex flex-col gap-2.5 px-3.5 pt-3.5 pb-2.5">
        <h1 className="m-0 text-sm font-semibold">
          {translate('components.prototypes.heading', 'Prototypes')}
        </h1>
        <div
          role="group"
          aria-label={translate('components.prototypes.filterGroup', 'Filter by agent')}
          className="flex flex-wrap gap-1.5"
        >
          {PROTOTYPE_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              onClick={() => onFilter(option)}
              className={cn(
                'h-6 rounded-full border border-border px-2.5 text-xs transition-colors',
                filter === option
                  ? 'bg-foreground text-background'
                  : 'bg-transparent text-foreground hover:bg-accent'
              )}
            >
              {prototypeFilterLabel(option)}
            </button>
          ))}
        </div>
      </div>
      <div className="scrollbar-sleek flex flex-col gap-0.5 overflow-y-auto px-2 pb-3">
        {groups.map((group) => {
          const { projectKey, projectName, system } = group
          return (
            <div key={projectKey ?? 'unprojected'} className="flex flex-col gap-0.5">
              {projectName === null ? null : (
                <span className="px-1.5 pt-3 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {projectName}
                </span>
              )}
              {projectKey === null || system === null ? null : (
                <SystemRow
                  system={system}
                  selected={selectedProjectKey === projectKey}
                  onSelect={() => onSelectSystem(projectKey)}
                />
              )}
              {group.rows.map((row) => (
                <SetRow
                  key={row.set.requestId}
                  row={row}
                  selected={row.set.requestId === selectedRequestId}
                  onSelect={() => onSelect(row.set.requestId)}
                />
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// The pinned row of a project's design system: its swatch icon when detected, its name and its line.
function SystemRow({
  system,
  selected,
  onSelect
}: {
  system: PrototypeListedDesignSystem
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md p-2.5 text-left text-foreground transition-colors',
        selected ? 'bg-accent' : 'hover:bg-accent/60'
      )}
    >
      {system.status === 'detected' ? <SwatchIcon swatches={system.swatches} /> : null}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">
          {translate('components.prototypes.list.designSystem', 'Design system')}
        </span>
        <span className="text-xs text-muted-foreground">{prototypeSystemLine(system)}</span>
      </span>
    </button>
  )
}

// Four color values in a 2×2 grid, the list icon of a detected system.
function SwatchIcon({ swatches }: { swatches: readonly string[] }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="grid size-[30px] shrink-0 grid-cols-2 gap-0.5 rounded-lg border border-border bg-card p-[5px]"
    >
      {swatches.map((color, index) => (
        <span key={`${index}:${color}`} className="rounded-sm" style={{ background: color }} />
      ))}
    </span>
  )
}

function SetRow({
  row,
  selected,
  onSelect
}: {
  row: PrototypeListRow
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  const builtOn = row.set.builtOn
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex flex-col gap-0.5 rounded-md p-2.5 text-left text-foreground transition-colors',
        selected ? 'bg-accent' : 'hover:bg-accent/60'
      )}
    >
      <span className="flex w-full justify-between gap-1.5">
        <span className="font-medium">{row.title}</span>
        <span className="text-[11px] text-muted-foreground">{row.age}</span>
      </span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="rounded border border-border px-1 font-mono text-[10px] text-foreground">
          {row.mono}
        </span>
        {prototypeAgentLabel(row.set.agent)}
      </span>
      <span className="text-xs text-muted-foreground">
        {joinParts([
          prototypeStatusLabel(row.status),
          builtOn === undefined ? null : prototypeBuiltOnLabel(builtOn)
        ])}
      </span>
    </button>
  )
}
