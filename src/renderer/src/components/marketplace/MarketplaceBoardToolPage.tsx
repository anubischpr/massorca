import { translate } from '@/i18n/i18n'
import { installLabel } from './MarketplaceCatalogStatusCopy'
import type { CatalogRow } from './MarketplaceCatalogRows'
import type { MarketplaceStatusTone } from './MarketplaceDetail'
import { MarketplaceNotesPage, type MarketplaceNotes } from './MarketplaceNotesPage'
import { pickedHostLabel } from './marketplace-picked-host-label'
import { useMarketplaceAppHost } from './use-marketplace-app-host'

const COPY = 'auto.components.marketplace.MarketplaceBoardToolPage'

/** GitHub CLI or Node.js: MassOrca has no install, account or options for either yet, so the page says why. */
export function MarketplaceBoardToolPage({
  row,
  onBack
}: {
  row: CatalogRow
  onBack: () => void
}): React.JSX.Element {
  const host = useMarketplaceAppHost()
  const hostName = pickedHostLabel(host)
  const isGitHubCli = row.target?.kind === 'board-tool' && row.target.id === 'gh'
  const status = toolStatus(row, isGitHubCli, hostName)
  const notes: MarketplaceNotes = {
    install: isGitHubCli
      ? translate(
          `${COPY}.githubCliInstall`,
          'MassOrca cannot install GitHub CLI yet. Install it from cli.github.com.'
        )
      : translate(`${COPY}.nodeInstall`, 'MassOrca cannot install Node.js yet.'),
    banner: translate(`${COPY}.banner`, '{{name}} has no example prompts.', { name: row.name }),
    connection: isGitHubCli
      ? translate(
          `${COPY}.githubCliConnection`,
          'GitHub CLI signs in with gh auth login on each host. The GitHub page under Services shows that sign-in.'
        )
      : translate(`${COPY}.nodeConnection`, 'Node.js needs no account.'),
    access: translate(
      `${COPY}.access`,
      'Every agent on {{host}} can run it. Limits per agent are not available for tools yet.',
      { host: hostName }
    ),
    advanced: translate(`${COPY}.advanced`, '{{name}} has no options in MassOrca.', {
      name: row.name
    }),
    uninstall: translate(`${COPY}.uninstall`, 'MassOrca does not remove {{name}}.', {
      name: row.name
    })
  }
  return (
    <MarketplaceNotesPage row={row} host={host} notes={notes} status={status} onBack={onBack} />
  )
}

/** A tool's header line states what is known: installed, not installed for GitHub CLI, else that nothing is checked. */
function toolStatus(
  row: CatalogRow,
  isGitHubCli: boolean,
  hostName: string
): { label: string; tone: MarketplaceStatusTone } {
  if (row.status.kind === 'done') {
    return { label: row.status.label, tone: 'ok' }
  }
  if (!isGitHubCli) {
    return {
      label: translate(`${COPY}.noCheck`, 'No install check for {{name}} yet', { name: row.name }),
      tone: 'pending'
    }
  }
  // Why: the GitHub CLI check reads the host, so its pending action line means not installed there.
  if (row.status.label === installLabel()) {
    return {
      label: translate(`${COPY}.notInstalled`, 'Not installed on {{host}}', { host: hostName }),
      tone: 'warn'
    }
  }
  return { label: row.status.label, tone: 'pending' }
}
