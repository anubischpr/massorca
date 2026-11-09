import { BookOpen } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import type {
  MarketplaceHostProgramId,
  MarketplaceHostProgramStatus
} from '../../../../shared/rpc-contract/marketplace-host-program-params'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { MarketplaceAppSection } from './MarketplaceAppSection'
import { notInstalledLabel } from './MarketplaceCatalogStatusCopy'
import type { CatalogRow } from './MarketplaceCatalogRows'
import { MarketplaceBreadcrumb, MarketplaceItemHeader } from './MarketplaceDetail'
import { MarketplaceFunctionNote } from './MarketplaceFunctionNote'
import {
  MarketplaceHostProgramInstall,
  MarketplaceHostProgramUninstall
} from './MarketplaceHostProgramControls'
import { MarketplaceIntegrationAdvanced } from './MarketplaceIntegrationAdvanced'
import { MarketplacePageHostRow } from './MarketplacePageHostRow'
import type { MarketplaceStatusTone } from './MarketplaceDetail'
import { pickedHostLabel } from './marketplace-picked-host-label'
import { useMarketplaceAppHost } from './use-marketplace-app-host'
import { useMarketplaceHostProgram } from './use-marketplace-host-program'

const COPY = 'auto.components.marketplace.MarketplaceBoardToolPage'

function toolProgram(row: CatalogRow): MarketplaceHostProgramId {
  return row.target?.kind === 'board-tool' && row.target.id === 'gh' ? 'gh' : 'node'
}

/** GitHub CLI or Node.js: installed and removed on the picked host, with no account or options of their own. */
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
  const program = useMarketplaceHostProgram(toolProgram(row), host.selectedKey ?? 'local', () => {
    // Why: the catalog row and the Tasks sidebar read this computer's preflight, so it is read again.
    if (host.selectedKey === null) {
      void useAppStore.getState().refreshPreflightStatus({ force: true })
    }
  })
  const status =
    programStatusLine(program?.status, hostName) ?? toolStatus(row, isGitHubCli, hostName)
  const Glyph = row.icon.kind === 'glyph' ? row.icon.glyph : BookOpen
  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex max-w-4xl flex-col gap-6 py-4')}>
      <MarketplacePageHostRow host={host}>
        <MarketplaceBreadcrumb name={row.name} onBack={onBack} />
      </MarketplacePageHostRow>
      <MarketplaceItemHeader
        icon={<Glyph className="size-6" aria-hidden />}
        name={row.name}
        description={row.description || null}
        statusTone={status.tone}
        status={status.label}
      />
      {program ? <MarketplaceHostProgramInstall program={program} host={hostName} /> : null}
      <MarketplaceFunctionNote part="banner">
        {translate(`${COPY}.banner`, '{{name}} has no example prompts.', { name: row.name })}
      </MarketplaceFunctionNote>
      <MarketplaceAppSection
        id="connection"
        title={translate(
          'auto.components.marketplace.MarketplaceAppConnection.title',
          'Connection'
        )}
      >
        <MarketplaceFunctionNote part="connection">
          {isGitHubCli
            ? translate(
                `${COPY}.githubCliConnection`,
                'GitHub CLI signs in with gh auth login on each host. The GitHub page under Services shows that sign-in.'
              )
            : translate(`${COPY}.nodeConnection`, 'Node.js needs no account.')}
        </MarketplaceFunctionNote>
      </MarketplaceAppSection>
      <MarketplaceIntegrationAdvanced>
        <MarketplaceFunctionNote
          part="access"
          label={translate(
            'auto.components.marketplace.MarketplaceAppAccess.title',
            'Who can use it'
          )}
        >
          {translate(
            `${COPY}.access`,
            'Every agent on {{host}} can run it. Limits per agent are not available for tools yet.',
            { host: hostName }
          )}
        </MarketplaceFunctionNote>
        <MarketplaceFunctionNote part="advanced">
          {translate(`${COPY}.advanced`, '{{name}} has no options in MassOrca.', {
            name: row.name
          })}
        </MarketplaceFunctionNote>
      </MarketplaceIntegrationAdvanced>
      <MarketplaceAppSection
        id="danger"
        title={translate('auto.components.marketplace.MarketplaceAppDanger.title', 'Danger zone')}
      >
        {program ? <MarketplaceHostProgramUninstall program={program} host={hostName} /> : null}
      </MarketplaceAppSection>
    </div>
  )
}

/** The header line once the host has answered: installed or not, with the version when it is known. */
function programStatusLine(
  status: MarketplaceHostProgramStatus | null | undefined,
  hostName: string
): { label: string; tone: MarketplaceStatusTone } | null {
  if (!status?.ok) {
    return null
  }
  return status.installed
    ? {
        label: translate(`${COPY}.installedOn`, 'Installed on {{host}}', { host: hostName }),
        tone: 'ok'
      }
    : {
        label: translate(`${COPY}.notInstalled`, 'Not installed on {{host}}', { host: hostName }),
        tone: 'warn'
      }
}

/** A tool's header line states what is known: installed, not installed for GitHub CLI, else that nothing is checked. */
export function toolStatus(
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
  // Why: the GitHub CLI check reads the host, so its pending line means not installed there.
  if (row.status.label === notInstalledLabel()) {
    return {
      label: translate(`${COPY}.notInstalled`, 'Not installed on {{host}}', { host: hostName }),
      tone: 'warn'
    }
  }
  return { label: row.status.label, tone: 'pending' }
}
