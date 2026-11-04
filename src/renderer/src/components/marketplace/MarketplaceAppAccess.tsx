import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import {
  MARKETPLACE_ACCESS_MODES,
  everyoneAccessPolicy,
  type MarketplaceAccessMode,
  type MarketplaceAppAccessPolicy
} from '../../../../shared/marketplace-apps'
import type { MarketplaceAppContext } from './marketplace-app-context'
import { MarketplaceAppAccessAgents } from './MarketplaceAppAccessAgents'
import { withAgentMode } from './MarketplaceAppAccessEdit'

/** Who may use the app: every Workspaces agent by default; bots keep the stored policy for later. */
export function MarketplaceAppAccess({ ctx }: { ctx: MarketplaceAppContext }): React.JSX.Element {
  const policy = ctx.status.access ?? everyoneAccessPolicy()
  const [saving, setSaving] = useState(false)
  const save = (next: MarketplaceAppAccessPolicy): void => {
    // Why: controls stay disabled until the save lands, so a second edit never builds on a stale policy.
    setSaving(true)
    void ctx
      .runInline((api) => api.setAccessPolicy({ id: ctx.appId, policy: next }))
      .finally(() => setSaving(false))
  }
  const noAgentPicked = policy.agents.mode === 'only' && policy.agents.ids.length === 0
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {translate('auto.components.marketplace.MarketplaceAppAccess.title', 'Who can use it')}
        </CardTitle>
        <CardDescription>
          {translate(
            'auto.components.marketplace.MarketplaceAppAccess.intro',
            'By default every Workspaces agent can use {{app}}. Limit it here only if you need to.',
            { app: ctx.info.name }
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {translate(
                  'auto.components.marketplace.MarketplaceAppAccess.agents',
                  'Workspaces agents'
                )}
              </p>
              <AccessModeToggle
                label={translate(
                  'auto.components.marketplace.MarketplaceAppAccess.agentsMode',
                  'Workspaces agents: who can use it'
                )}
                mode={policy.agents.mode}
                disabled={saving}
                onChange={(mode) => save({ ...policy, agents: withAgentMode(policy.agents, mode) })}
              />
            </div>
            {policy.agents.mode === 'everyone' ? null : (
              <MarketplaceAppAccessAgents
                agents={policy.agents}
                disabled={saving}
                onChange={(agents) => save({ ...policy, agents })}
              />
            )}
            {noAgentPicked ? (
              <p className="text-xs text-muted-foreground">
                {translate(
                  'auto.components.marketplace.MarketplaceAppAccess.noAgentPicked',
                  'No agent can use it until you pick one.'
                )}
              </p>
            ) : null}
            {ctx.appId === 'github' ? (
              <p className="text-xs text-muted-foreground">
                {translate(
                  'auto.components.marketplace.MarketplaceAppAccess.githubNote',
                  'For GitHub this only changes what MassOrca shows. It does not change what agents can reach.'
                )}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** The three-way choice; a click on the picked item keeps it, so one mode is always chosen. */
function AccessModeToggle({
  label,
  mode,
  disabled,
  onChange
}: {
  label: string
  mode: MarketplaceAccessMode
  disabled: boolean
  onChange: (mode: MarketplaceAccessMode) => void
}): React.JSX.Element {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={mode}
      disabled={disabled}
      aria-label={label}
      onValueChange={(next) => {
        const picked = MARKETPLACE_ACCESS_MODES.find((candidate) => candidate === next)
        if (picked) {
          onChange(picked)
        }
      }}
    >
      <ToggleGroupItem value="everyone">
        {translate('auto.components.marketplace.MarketplaceAppAccess.everyone', 'Everyone')}
      </ToggleGroupItem>
      <ToggleGroupItem value="only">
        {translate('auto.components.marketplace.MarketplaceAppAccess.only', 'Only these')}
      </ToggleGroupItem>
      <ToggleGroupItem value="except">
        {translate('auto.components.marketplace.MarketplaceAppAccess.except', 'All except')}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
