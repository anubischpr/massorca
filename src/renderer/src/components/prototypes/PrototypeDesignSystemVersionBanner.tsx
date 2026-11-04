import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

/** Shown over an earlier version of the design system: which one, how to return, and how to restore it. */
export function PrototypeDesignSystemVersionBanner({
  version,
  nextVersion,
  onBackToCurrent,
  onRestore
}: {
  version: number
  /** The version a restore makes, the one after the current. */
  nextVersion: number
  onBackToCurrent: () => void
  onRestore: () => void
}): React.JSX.Element {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 border-b border-border bg-sidebar px-4 py-2.5"
    >
      <span className="min-w-[240px] flex-1 text-xs">
        {translate(
          'components.prototypes.designSystem.versionPreviewBanner',
          'Viewing v{{version}} · read-only. Tokens, Components and Source show that version.',
          { version }
        )}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={onBackToCurrent}>
        {translate('components.prototypes.designSystem.versionBackToCurrent', 'Back to current')}
      </Button>
      <Button type="button" size="sm" onClick={onRestore}>
        <RotateCcw className="size-3.5" />
        {translate(
          'components.prototypes.designSystem.versionRestoreAs',
          'Restore as v{{version}}',
          { version: nextVersion }
        )}
      </Button>
    </div>
  )
}
