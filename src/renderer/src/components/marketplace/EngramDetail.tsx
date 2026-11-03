import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { translate } from '@/i18n/i18n'
import {
  MARKETPLACE_MCP_AGENTS,
  type MarketplaceDetection,
  type MarketplaceMcpAgent,
  type MarketplaceMcpEntryState
} from '../../../../shared/marketplace-types'
import { MARKETPLACE_AGENT_LABELS } from './marketplace-catalog'
import { MarketplaceInfoRow } from './MarketplaceInfoRow'
import { MarketplaceStatusBadge } from './MarketplaceStatusBadge'

type ChangeFailure = 'unreadable' | 'unsupported-shape' | 'changed-while-writing' | 'request-failed'

export function EngramDetail({
  detection,
  onChanged
}: {
  detection: MarketplaceDetection
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const programFound = detection.engram.cli === 'found'
  const [pendingAgent, setPendingAgent] = useState<MarketplaceMcpAgent | null>(null)
  const [errors, setErrors] = useState<Partial<Record<MarketplaceMcpAgent, string>>>({})

  const handleToggle = async (agent: MarketplaceMcpAgent, enabled: boolean): Promise<void> => {
    setPendingAgent(agent)
    const failure = await requestEngramMcpChange(agent, enabled)
    setErrors((current) => ({
      ...current,
      [agent]: failure ? changeFailedMessage(agent, failure) : undefined
    }))
    setPendingAgent(null)
    await onChanged()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <MarketplaceInfoRow
          label={translate('auto.components.marketplace.EngramDetail.program', 'Program')}
        >
          <FoundValue found={programFound} />
        </MarketplaceInfoRow>
        <MarketplaceInfoRow
          label={translate('auto.components.marketplace.EngramDetail.memoryStore', 'Memory store')}
        >
          <FoundValue found={detection.engram.store === 'found'} />
        </MarketplaceInfoRow>
      </div>
      {programFound ? null : (
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.marketplace.EngramDetail.installFirst',
            'Install Engram on this computer first.'
          )}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>
            {translate(
              'auto.components.marketplace.EngramDetail.agents',
              'Agents on this computer'
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-5">
            {MARKETPLACE_MCP_AGENTS.map((agent) => (
              <EngramAgentSettings
                key={agent}
                agent={agent}
                state={detection.engram.agents[agent]}
                programFound={programFound}
                pending={pendingAgent === agent}
                error={errors[agent]}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function EngramAgentSettings({
  agent,
  state,
  programFound,
  pending,
  error,
  onToggle
}: {
  agent: MarketplaceMcpAgent
  state: MarketplaceMcpEntryState
  programFound: boolean
  pending: boolean
  error: string | undefined
  onToggle: (agent: MarketplaceMcpAgent, enabled: boolean) => Promise<void>
}): React.JSX.Element {
  const agentLabel = MARKETPLACE_AGENT_LABELS[agent]
  const switchDisabled = !programFound || state === 'unreadable' || pending
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{agentLabel}</p>
      <MarketplaceInfoRow
        label={translate('auto.components.marketplace.EngramDetail.mcpServer', 'MCP server')}
      >
        {state === 'unreadable' ? <MarketplaceStatusBadge state="unreadable" /> : null}
        <Switch
          checked={state === 'set'}
          disabled={switchDisabled}
          onCheckedChange={(enabled) => void onToggle(agent, enabled)}
          aria-label={translate(
            'auto.components.marketplace.EngramDetail.mcpSwitch',
            'Engram MCP server for {{agent}}',
            { agent: agentLabel }
          )}
        />
      </MarketplaceInfoRow>
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.marketplace.EngramDetail.backupNote',
          'MassOrca backs up the settings file before changing it.'
        )}
      </p>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <MarketplaceInfoRow
        label={translate('auto.components.marketplace.EngramDetail.hooks', 'Hooks')}
      >
        <MarketplaceStatusBadge state="coming-soon" />
      </MarketplaceInfoRow>
      <MarketplaceInfoRow
        label={translate('auto.components.marketplace.EngramDetail.instructions', 'Instructions')}
      >
        <MarketplaceStatusBadge state="coming-soon" />
      </MarketplaceInfoRow>
    </div>
  )
}

function FoundValue({ found }: { found: boolean }): React.JSX.Element {
  return (
    <span className="text-sm text-muted-foreground">
      {found
        ? translate('auto.components.marketplace.EngramDetail.found', 'Found')
        : translate('auto.components.marketplace.EngramDetail.notFound', 'Not found')}
    </span>
  )
}

async function requestEngramMcpChange(
  agent: MarketplaceMcpAgent,
  enabled: boolean
): Promise<ChangeFailure | null> {
  try {
    const result = await window.api.marketplace.setEngramMcp({ agent, enabled })
    return result.ok ? null : result.reason
  } catch {
    return 'request-failed'
  }
}

function changeFailedMessage(agent: MarketplaceMcpAgent, failure: ChangeFailure): string {
  return translate(
    'auto.components.marketplace.EngramDetail.changeFailed',
    "Could not change {{agent}}'s settings: {{reason}}",
    { agent: MARKETPLACE_AGENT_LABELS[agent], reason: failureReason(failure) }
  )
}

function failureReason(failure: ChangeFailure): string {
  switch (failure) {
    case 'unreadable':
      return translate(
        'auto.components.marketplace.EngramDetail.reasonUnreadable',
        'the settings file could not be read.'
      )
    case 'unsupported-shape':
      return translate(
        'auto.components.marketplace.EngramDetail.reasonUnsupported',
        'the settings file has a format MassOrca does not recognize.'
      )
    case 'changed-while-writing':
      return translate(
        'auto.components.marketplace.EngramDetail.reasonChanged',
        'the settings file changed while MassOrca was writing it. Try again.'
      )
    case 'request-failed':
      return translate(
        'auto.components.marketplace.EngramDetail.reasonRequestFailed',
        'the change did not complete. Try again.'
      )
  }
}
