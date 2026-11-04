import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { DesignSystemVersionListed } from '../../../../shared/rpc-contract/prototype-params'
import { VersionHistoryList, type VersionHistoryItem } from '../version-history/VersionHistoryList'
import { designSystemVersionMeta } from './prototype-design-system-version-labels'

/**
 * The aside's Versions list: the current version with no buttons, each saved earlier one with Preview and
 * Restore, and each unsaved one named and dated with none.
 */
export function PrototypeDesignSystemVersionsPanel({
  versions,
  onPreview,
  onRestore
}: {
  /** Newest first, as the host lists them. */
  versions: readonly DesignSystemVersionListed[]
  onPreview: (version: number) => void
  onRestore: (version: number) => void
}): React.JSX.Element {
  // Why: the day labels are read once when the list opens, so a render never reads the clock.
  const [now] = useState(() => new Date())
  const items: VersionHistoryItem[] = versions.map((version) => {
    const meta = designSystemVersionMeta(version, now)
    const label = version.current
      ? translate('components.prototypes.designSystem.versionCurrent', 'Current · v{{version}}', {
          version: version.version
        })
      : translate('components.prototypes.designSystem.versionEarlier', 'v{{version}}', {
          version: version.version
        })
    return {
      key: String(version.version),
      label,
      ...(meta === undefined ? {} : { meta }),
      ...(version.current || !version.saved
        ? {}
        : {
            actions: (
              <>
                <Button variant="outline" size="xs" onClick={() => onPreview(version.version)}>
                  {translate('components.prototypes.designSystem.versionPreview', 'Preview')}
                </Button>
                <Button variant="outline" size="xs" onClick={() => onRestore(version.version)}>
                  <RotateCcw className="size-3" />
                  {translate('components.prototypes.designSystem.versionRestore', 'Restore')}
                </Button>
              </>
            )
          })
    }
  })
  return (
    <div className="flex flex-col gap-3 p-3">
      <h2 className="text-sm font-semibold">
        {translate(
          'components.prototypes.designSystem.versionsTitle',
          'Versions of the design system'
        )}
      </h2>
      <VersionHistoryList items={items} />
      <p className="text-xs text-muted-foreground">
        {translate(
          'components.prototypes.designSystem.versionsNote',
          'Restoring copies that version into a new one. No version is deleted.'
        )}
      </p>
    </div>
  )
}
