import { Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'

/** The merge's progress row, from the click until the plan or the merged direction arrives. */
export function PrototypeMergeProgress({ onCancel }: { onCancel: () => void }): React.JSX.Element {
  return (
    <div
      role="status"
      className="flex h-10 shrink-0 items-center gap-2.5 border-b border-border bg-muted/30 px-4 text-xs"
    >
      <Loader2 aria-hidden="true" className="size-4 animate-spin text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        {translate('components.prototypes.mergeProgress', 'Processing merge')}
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        {translate('components.prototypes.mergeCancel', 'Cancel')}
      </Button>
    </div>
  )
}
