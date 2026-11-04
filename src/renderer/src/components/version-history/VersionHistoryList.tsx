import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type VersionHistoryItem = {
  key: string
  label: string
  meta?: string
  /** Buttons at the end of the row; the current version has none. */
  actions?: ReactNode
}

/** A file's versions as rows, newest first: each named and dated, with its actions at the end. */
export function VersionHistoryList({
  items
}: {
  items: readonly VersionHistoryItem[]
}): React.JSX.Element {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      {items.map((item, index) => (
        <div
          key={item.key}
          className={cn('flex items-center gap-3 px-4 py-3', index > 0 && 'border-t border-border')}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{item.label}</div>
            {item.meta === undefined ? null : (
              <div className="truncate text-xs text-muted-foreground">{item.meta}</div>
            )}
          </div>
          {item.actions}
        </div>
      ))}
    </div>
  )
}
