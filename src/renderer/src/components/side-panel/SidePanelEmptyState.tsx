import { Button } from '@/components/ui/button'
import { SidePanelKindIcon } from './SidePanelNewTabMenu'
import type { SidePanelNewTabKind, SidePanelNewTabOption } from './side-panel-new-tab-options'

/** What an open panel with no tabs shows: the four ways to start one. */
export function SidePanelEmptyState({
  options,
  onCreate
}: {
  options: readonly SidePanelNewTabOption[]
  onCreate: (kind: SidePanelNewTabKind) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-6 text-center">
      {options.map((option) => (
        <Button
          key={option.kind}
          type="button"
          variant="outline"
          onClick={() => onCreate(option.kind)}
        >
          <SidePanelKindIcon kind={option.kind} />
          {option.label}
        </Button>
      ))}
    </div>
  )
}
