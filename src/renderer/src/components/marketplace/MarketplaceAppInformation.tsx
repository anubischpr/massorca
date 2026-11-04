import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import {
  MARKETPLACE_APP_AGENTS,
  type MarketplaceAppAgentStatus
} from '../../../../shared/marketplace-apps'
import { MarketplaceAgentMark } from './marketplace-agent-mark'
import type { MarketplaceAppContext } from './marketplace-app-context'
import { marketplaceAgentLabel } from './marketplace-catalog'
import { websiteLabel } from './marketplace-app-info'
import { MarketplaceAppSection } from './MarketplaceAppSection'

/** Description, developer facts, and how each agent uses the app. */
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
        {translate(info.description.key, info.description.fallback)}
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
      {agents.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <p className="text-sm font-medium">
            {translate(
              'auto.components.marketplace.MarketplaceAppInformation.agentUsage',
              'How each agent uses it'
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.marketplace.MarketplaceAppInformation.everyAgent',
              'Every agent and bot gets {{app}} once it is connected.',
              { app: info.name }
            )}
          </p>
          <ul className="flex flex-col">
            {agents.map((agent) => (
              <AgentUsageRow key={agent.agent} app={info.name} agent={agent} />
            ))}
          </ul>
        </div>
      ) : null}
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
  app,
  agent
}: {
  app: string
  agent: MarketplaceAppAgentStatus
}): React.JSX.Element {
  const usage = usageCopy(app, agent)
  return (
    <li className="flex items-start gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="mt-0.5 flex shrink-0 items-center justify-center">
        <MarketplaceAgentMark agent={agent.agent} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">{marketplaceAgentLabel(agent.agent)}</p>
        <p className="text-xs text-muted-foreground">{usage.line}</p>
        {agent.entry === 'unreadable' ? (
          <p className="text-xs text-destructive">
            {translate(
              'auto.components.marketplace.MarketplaceAppInformation.unreadable',
              "Could not read this agent's settings."
            )}
          </p>
        ) : null}
      </div>
      <Badge variant={usage.variant}>{usage.label}</Badge>
    </li>
  )
}

function usageCopy(
  app: string,
  agent: MarketplaceAppAgentStatus
): { label: string; line: string; variant: 'secondary' | 'outline' } {
  if (agent.entry === 'built-in' || agent.level === 'built-in') {
    return {
      label: translate('auto.components.marketplace.MarketplaceAppInformation.builtIn', 'Built in'),
      line: translate(
        'auto.components.marketplace.MarketplaceAppInformation.builtInLine',
        'Already has {{app}} support built in.',
        { app }
      ),
      variant: 'outline'
    }
  }
  if (agent.level === 'full') {
    return {
      label: translate(
        'auto.components.marketplace.MarketplaceAppInformation.fullIntegration',
        'Full integration'
      ),
      line: translate(
        'auto.components.marketplace.MarketplaceAppInformation.fullLine',
        'Uses {{app}} on its own, without being asked.',
        { app }
      ),
      variant: 'secondary'
    }
  }
  return {
    label: translate(
      'auto.components.marketplace.MarketplaceAppInformation.toolsOnly',
      'Tools only'
    ),
    line: translate(
      'auto.components.marketplace.MarketplaceAppInformation.toolsOnlyLine',
      'Uses {{app}} tools when you ask for them.',
      { app }
    ),
    variant: 'outline'
  }
}
