import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { AgentCatalogRowProps } from '../settings/AgentCatalogRow'
import { stringifyAgentDefaultEnvDraft } from '../settings/agent-default-env-draft'
import {
  AgentCommandOverrideInput,
  AgentDefaultArgsInput,
  AgentDefaultEnvInput
} from '../settings/AgentLaunchDefaultsEditor'
import { SettingsSegmentedControl } from '../settings/SettingsFormControls'
import { MarketplaceCard, MarketplaceCardLabel, MarketplaceCardRow } from './MarketplaceDetail'

type Editing = 'command' | 'env' | null
type Use = 'on' | 'off'

function variablesText(count: number): string {
  return count === 1
    ? translate('auto.components.marketplace.MarketplaceAgentPage.oneVariable', '1 variable')
    : translate('auto.components.marketplace.MarketplaceAgentPage.variables', '{{n}} variables', {
        n: count
      })
}

/** "On <host>": use, default, launch command and environment, written to the same settings as Settings > Agents. */
export function MarketplaceAgentSettings({
  hostName,
  row
}: {
  hostName: string
  row: AgentCatalogRowProps
}): React.JSX.Element {
  const [editing, setEditing] = useState<Editing>(null)
  const toggle = (next: Exclude<Editing, null>): void =>
    setEditing((current) => (current === next ? null : next))
  const command = [row.cmdOverride || row.defaultCmd, row.argsOverride].filter(Boolean).join(' ')
  const use: Use = row.isEnabled ? 'on' : 'off'
  return (
    <section data-marketplace-agent-settings>
      <MarketplaceCardLabel>
        {translate('auto.components.marketplace.MarketplaceAgentPage.onHost', 'On {{host}}', {
          host: hostName
        })}
      </MarketplaceCardLabel>
      <MarketplaceCard>
        <MarketplaceCardRow
          name={translate('auto.components.marketplace.MarketplaceAgentPage.use', 'Use this agent')}
          description={translate(
            'auto.components.marketplace.MarketplaceAgentPage.useHelp',
            'Shows it in agent pickers on this host.'
          )}
        >
          <SettingsSegmentedControl<Use>
            value={use}
            size="sm"
            ariaLabel={translate(
              'auto.components.settings.AgentsPane.1c9a9679ec',
              '{{value0}} availability',
              { value0: row.label }
            )}
            onChange={(next) => {
              if (next !== use) {
                row.onSetEnabled(next === 'on')
              }
            }}
            options={[
              {
                value: 'on',
                label: translate('auto.components.marketplace.MarketplaceAgentPage.on', 'On')
              },
              {
                value: 'off',
                label: translate('auto.components.marketplace.MarketplaceAgentPage.off', 'Off')
              }
            ]}
          />
        </MarketplaceCardRow>
        <MarketplaceCardRow
          name={translate(
            'auto.components.marketplace.MarketplaceAgentPage.defaultAgent',
            'Default agent'
          )}
          description={translate(
            'auto.components.marketplace.MarketplaceAgentPage.defaultHelp',
            'New workspaces on this host start with it.'
          )}
        >
          {row.isDefault ? (
            <Button type="button" variant="outline" size="xs" disabled>
              <Check />
              {translate('auto.components.settings.AgentsPane.24e032fa34', 'Default')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={!row.isDetected || !row.isEnabled}
              onClick={row.onSetDefault}
            >
              {translate(
                'auto.components.marketplace.MarketplaceAgentPage.setDefault',
                'Set as default'
              )}
            </Button>
          )}
        </MarketplaceCardRow>
        <div>
          <MarketplaceCardRow
            name={translate(
              'auto.components.marketplace.MarketplaceAgentPage.launchCommand',
              'Launch command'
            )}
            description={command}
            mono
          >
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-expanded={editing === 'command'}
              // Why: the command override only applies to an agent found on this host.
              disabled={!row.isDetected}
              onClick={() => toggle('command')}
            >
              {translate('auto.components.marketplace.MarketplaceAgentPage.edit', 'Edit')}
            </Button>
          </MarketplaceCardRow>
          {editing === 'command' && row.isDetected ? (
            <div className="flex flex-col gap-2 px-4 pb-3">
              <AgentCommandOverrideInput
                key={row.cmdOverride ?? row.defaultCmd}
                defaultCmd={row.defaultCmd}
                cmdOverride={row.cmdOverride}
                onSaveOverride={row.onSaveOverride}
              />
              <AgentDefaultArgsInput
                key={`${row.agentId}:${row.argsOverride}`}
                defaultArgs={row.defaultArgs}
                argsOverride={row.argsOverride}
                onSaveArgs={row.onSaveArgs}
              />
            </div>
          ) : null}
        </div>
        <div>
          <MarketplaceCardRow
            name={translate(
              'auto.components.marketplace.MarketplaceAgentPage.environment',
              'Environment variables'
            )}
            description={variablesText(Object.keys(row.envOverride).length)}
          >
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-expanded={editing === 'env'}
              onClick={() => toggle('env')}
            >
              {translate('auto.components.marketplace.MarketplaceAgentPage.edit', 'Edit')}
            </Button>
          </MarketplaceCardRow>
          {editing === 'env' ? (
            <div className="px-4 pb-3">
              <AgentDefaultEnvInput
                key={`${row.agentId}:${stringifyAgentDefaultEnvDraft(row.envOverride)}`}
                defaultEnv={row.defaultEnv}
                envOverride={row.envOverride}
                onSaveEnv={row.onSaveEnv}
              />
            </div>
          ) : null}
        </div>
      </MarketplaceCard>
    </section>
  )
}
