import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import {
  PROTOTYPE_FILTERS,
  type PrototypeFilter,
  type PrototypeListRow
} from './prototype-list-model'
import { prototypeAgentLabel, prototypeFilterLabel, prototypeStatusLabel } from './prototype-labels'

/** The left column: the heading, the agent filter, and one row per set, newest first. */
export function PrototypeListPanel({
  rows,
  filter,
  onFilter,
  selectedRequestId,
  onSelect
}: {
  rows: readonly PrototypeListRow[]
  filter: PrototypeFilter
  onFilter: (filter: PrototypeFilter) => void
  selectedRequestId: string | null
  onSelect: (requestId: string) => void
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
        {rows.map((row) => (
          <button
            key={row.set.requestId}
            type="button"
            onClick={() => onSelect(row.set.requestId)}
            aria-current={row.set.requestId === selectedRequestId ? 'true' : undefined}
            className={cn(
              'flex flex-col gap-0.5 rounded-md p-2.5 text-left text-foreground transition-colors',
              row.set.requestId === selectedRequestId ? 'bg-accent' : 'hover:bg-accent/60'
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
              {prototypeStatusLabel(row.status)}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
