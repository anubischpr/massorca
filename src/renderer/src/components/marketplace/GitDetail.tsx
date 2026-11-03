import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { GIT_DOWNLOADS_URL } from './marketplace-catalog'
import type { MarketplaceBadgeState } from './marketplace-status'

export function GitDetail({ state }: { state: MarketplaceBadgeState }): React.JSX.Element {
  if (state === 'installed') {
    return (
      <p className="text-sm">
        {translate(
          'auto.components.marketplace.GitDetail.installed',
          'Git is installed on this computer.'
        )}
      </p>
    )
  }
  if (state === 'not-installed') {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm">
          {translate(
            'auto.components.marketplace.GitDetail.notInstalled',
            'Git is not installed on this computer.'
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void window.api.shell.openUrl(GIT_DOWNLOADS_URL)}
        >
          {translate('auto.components.marketplace.GitDetail.getGit', 'Get Git')}
        </Button>
      </div>
    )
  }
  return (
    <p className="text-sm text-muted-foreground">
      {state === 'unknown'
        ? translate(
            'auto.components.marketplace.GitDetail.unknown',
            'Could not check Git on this computer.'
          )
        : translate(
            'auto.components.marketplace.GitDetail.checking',
            'Checking Git on this computer…'
          )}
    </p>
  )
}
