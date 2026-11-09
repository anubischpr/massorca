import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import {
  MARKETPLACE_APP_AGENTS,
  isMarketplaceAgentEntryMissing,
  type MarketplaceAppAgentStatus,
  type MarketplaceAppId
} from '../../../../shared/marketplace-apps'
import { MarketplaceAgentMark } from './marketplace-agent-mark'
import type { MarketplaceAppContext } from './marketplace-app-context'
import { marketplaceAgentLabel } from './marketplace-catalog'
import { websiteLabel } from './marketplace-app-info'
import { MarketplaceAppSection } from './MarketplaceAppSection'

/** Description, developer facts, and how each agent uses the app, whether it is connected or not. */
export function MarketplaceAppInformation({
  ctx
}: {
  ctx: MarketplaceAppContext
}): React.JSX.Element {
  const { info, status } = ctx
  const version = versionLabel(ctx)
  const agents = MARKETPLACE_APP_AGENTS.flatMap((agent) =>
    status.agents.filter((entry) => entry.agent === agent)
  )
  return (
    <MarketplaceAppSection
      id="information"
      title={translate(
        'auto.components.marketplace.MarketplaceAppInformation.title',
        'Information'
      )}
    >
      <p className="text-sm text-muted-foreground">
        {/* Why: the GitHub description names this computer; a picked host gets its own line. */}
        {ctx.appId === 'github' && ctx.hostLabel
          ? translate(
              'auto.components.marketplace.MarketplaceAppInformation.githubHostDescription',
              'Pull requests, issues and checks from GitHub, through the GitHub CLI on {{host}}.',
              { host: ctx.hostLabel }
            )
          : translate(info.description.key, info.description.fallback)}
      </p>
      <dl className="flex flex-col">
        <InfoRow
          label={translate(
            'auto.components.marketplace.MarketplaceAppInformation.developer',
            'Developer'
          )}
        >
          {info.developer}
        </InfoRow>
        <InfoRow
          label={translate(
            'auto.components.marketplace.MarketplaceAppInformation.category',
            'Category'
          )}
        >
          {translate(info.category.key, info.category.fallback)}
        </InfoRow>
        {version ? (
          <InfoRow
            label={translate(
              'auto.components.marketplace.MarketplaceAppInformation.version',
              'Version'
            )}
          >
            {version}
          </InfoRow>
        ) : null}
        <InfoRow
          label={translate(
            'auto.components.marketplace.MarketplaceAppInformation.website',
            'Website'
          )}
        >
          <LinkValue url={info.website} />
        </InfoRow>
        {info.privacyUrl ? (
          <InfoRow
            label={translate(
              'auto.components.marketplace.MarketplaceAppInformation.privacy',
              'Privacy policy'
            )}
          >
            <LinkValue url={info.privacyUrl} />
          </InfoRow>
        ) : null}
        {info.termsUrl ? (
          <InfoRow
            label={translate(
              'auto.components.marketplace.MarketplaceAppInformation.terms',
              'Terms of service'
            )}
          >
            <LinkValue url={info.termsUrl} />
          </InfoRow>
        ) : null}
      </dl>
      <div className="flex flex-col rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-0.5 px-4 py-3">
          <p className="text-sm font-semibold">
            {translate(
              'auto.components.marketplace.MarketplaceAppInformation.agentUsage',
              'How each agent uses it'
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.marketplace.MarketplaceAppInformation.everyAgent',
              'Every agent and bot gets {{app}} once it is connected. To limit it, use Who can use it in Advanced options.',
              { app: info.name }
            )}
          </p>
        </div>
        <ul className="flex flex-col">
          {agents.map((agent) => (
            <AgentUsageRow key={agent.agent} appId={ctx.appId} agent={agent} />
          ))}
        </ul>
      </div>
    </MarketplaceAppSection>
  )
}

function versionLabel(ctx: MarketplaceAppContext): string | null {
  if (ctx.appId === 'openmetadata') {
    return translate(
      'auto.components.marketplace.MarketplaceAppInformation.yourServer',
      'Your server'
    )
  }
  if (ctx.appId === 'engram' && ctx.status.program?.found && ctx.status.program.version) {
    return ctx.status.program.version
  }
  return null
}

function InfoRow({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm">{children}</dd>
    </div>
  )
}

function LinkValue({ url }: { url: string }): React.JSX.Element {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
      onClick={() => void window.api.shell.openUrl(url)}
    >
      {websiteLabel(url)}
      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
    </button>
  )
}

function AgentUsageRow({
  appId,
  agent
}: {
  appId: MarketplaceAppId
  agent: MarketplaceAppAgentStatus
}): React.JSX.Element {
  const missing = isMarketplaceAgentEntryMissing(appId, agent)
  const usage = missing ? missingUsage() : usageCopy(appId, agent)
  return (
    <li className="flex items-center gap-3 border-t border-border px-4 py-3">
      <span className="flex shrink-0 items-center justify-center">
        <MarketplaceAgentMark agent={agent.agent} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{marketplaceAgentLabel(agent.agent)}</p>
        <p className="text-xs text-muted-foreground">{usage.line}</p>
        {agent.entry === 'unreadable' ? (
          <p className="text-xs text-destructive">
            {translate(
              'auto.components.marketplace.MarketplaceAppInformation.unreadable',
              "Could not read this agent's settings."
            )}
          </p>
        ) : null}
        {agent.outsideHome === true ? (
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.marketplace.MarketplaceAppInformation.outsideHome',
              "Its settings file links outside this agent's home, so MassOrca left it alone."
            )}
          </p>
        ) : null}
      </div>
      <Badge variant={missing ? 'outline' : 'secondary'}>{usage.label}</Badge>
    </li>
  )
}

function missingUsage(): { label: string; line: string } {
  return {
    label: translate('auto.components.marketplace.MarketplaceAppInformation.missing', 'Missing'),
    line: translate(
      'auto.components.marketplace.MarketplaceAppInformation.missingLine',
      'This agent has no entry for the app yet. Connect adds it.'
    )
  }
}

function usageCopy(
  appId: MarketplaceAppId,
  agent: MarketplaceAppAgentStatus
): { label: string; line: string } {
  // Why: Gentle Shell's own Engram is part of its ODD harness, so it uses memory as fully as any agent.
  if (appId === 'engram' && agent.agent === 'gentle-shell' && agent.entry === 'built-in') {
    return {
      label: translate(
        'auto.components.marketplace.MarketplaceAppInformation.fullIntegration',
        'Full integration'
      ),
      line: translate(
        'auto.components.marketplace.MarketplaceAppInformation.gentleShellEngramLine',
        'Built into its harness: uses memory by itself in every session. MassOrca adds nothing.'
      )
    }
  }
  if (agent.entry === 'built-in' || agent.level === 'built-in') {
    return {
      label: translate('auto.components.marketplace.MarketplaceAppInformation.builtIn', 'Built in'),
      line: translate(
        'auto.components.marketplace.MarketplaceAppInformation.builtInLine',
        'Brings it itself. MassOrca keeps it and adds nothing.'
      )
    }
  }
  if (agent.level === 'full') {
    return {
      label: translate(
        'auto.components.marketplace.MarketplaceAppInformation.fullIntegration',
        'Full integration'
      ),
      line: fullLine(appId)
    }
  }
  return {
    label: translate(
      'auto.components.marketplace.MarketplaceAppInformation.toolsOnly',
      'Tools only'
    ),
    line: toolsOnlyLine(appId)
  }
}

// Why: the board words each app's two levels on its own, so the sentences are not built from the app name.
function fullLine(appId: MarketplaceAppId): string {
  switch (appId) {
    case 'engram':
      return translate(
        'auto.components.marketplace.MarketplaceAppInformation.engramFullLine',
        'Uses memory by itself in every session.'
      )
    case 'openmetadata':
      return translate(
        'auto.components.marketplace.MarketplaceAppInformation.openMetadataFullLine',
        'Checks the context center by itself when a prompt needs company data.'
      )
    case 'github':
      return translate(
        'auto.components.marketplace.MarketplaceAppInformation.githubFullLine',
        'Uses GitHub by itself when the work needs it.'
      )
  }
}

function toolsOnlyLine(appId: MarketplaceAppId): string {
  switch (appId) {
    case 'engram':
      return translate(
        'auto.components.marketplace.MarketplaceAppInformation.engramToolsLine',
        'Saves and searches memories when you ask.'
      )
    case 'openmetadata':
      return translate(
        'auto.components.marketplace.MarketplaceAppInformation.openMetadataToolsLine',
        'Uses OpenMetadata when you ask.'
      )
    case 'github':
      return translate(
        'auto.components.marketplace.MarketplaceAppInformation.githubToolsLine',
        'Uses GitHub when you ask.'
      )
  }
}
