import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { PrototypeListedDirection } from '../../../../shared/rpc-contract/prototype-params'
import { botTeamVersionTime } from '../bot-teams/bot-team-version-labels'
import { VersionHistoryList, type VersionHistoryItem } from '../version-history/VersionHistoryList'

type DirectionVersion = PrototypeListedDirection['versions'][number]

/**
 * The versions of the direction on screen, newest first: the current one, then each earlier one to preview
 * or restore. Restore is left out where the host cannot take it.
 */
export function PrototypeVersionsPanel({
  letter,
  versions,
  canRestore,
  onPreview,
  onRestore
}: {
  letter: string
  /** Newest first; the first one is the current version. */
  versions: readonly DirectionVersion[]
  canRestore: boolean
  onPreview: (version: DirectionVersion) => void
  onRestore: (version: DirectionVersion) => void
}): React.JSX.Element {
  const [current, ...earlier] = versions
  const items: VersionHistoryItem[] = []
  if (current !== undefined) {
    items.push({
      key: current.fileName,
      label: translate('components.prototypes.versionCurrent', 'Current · v{{version}}', {
        version: current.version
      }),
      meta: botTeamVersionTime(current.mtime)
    })
  }
  for (const version of earlier) {
    items.push({
      key: version.fileName,
      label: translate('components.prototypes.versionEarlier', 'v{{version}}', {
        version: version.version
      }),
      meta: botTeamVersionTime(version.mtime),
      actions: (
        <>
          <Button variant="outline" size="xs" onClick={() => onPreview(version)}>
            {translate('components.prototypes.versionPreview', 'Preview')}
          </Button>
          {canRestore ? (
            <Button variant="outline" size="xs" onClick={() => onRestore(version)}>
              <RotateCcw className="size-3" />
              {translate('components.prototypes.versionRestore', 'Restore')}
            </Button>
          ) : null}
        </>
      )
    })
  }
  return (
    <aside className="scrollbar-sleek flex min-h-0 w-[360px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border p-4">
      <h2 className="text-sm font-semibold">
        {translate('components.prototypes.versionsTitle', 'Versions of {{letter}}', { letter })}
      </h2>
      <VersionHistoryList items={items} />
      <p className="text-xs text-muted-foreground">
        {translate(
          'components.prototypes.versionsNote',
          'Restoring copies that version into a new one. No version is deleted.'
        )}
      </p>
    </aside>
  )
}
