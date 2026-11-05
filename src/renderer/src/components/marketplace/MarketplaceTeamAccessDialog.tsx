import { useEffect, useState } from 'react'
import { BotTeamCharacterIcon } from '@/components/bot-teams/BotTeamCharacterIcon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { MarketplaceAppsState } from '@/store/slices/ui/ui-slice-contract-core'
import {
  MARKETPLACE_AGENT_DENIAL_UNSUPPORTED_MESSAGE,
  everyoneAccessPolicy,
  type MarketplaceAppStatus
} from '../../../../shared/marketplace-apps'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import {
  marketplaceTeamAllowed,
  withTeamAllowed,
  withUnsupportedBotsKept
} from './MarketplaceAppAccessEdit'
import { MARKETPLACE_APP_INFO } from './marketplace-app-info'
import { MarketplaceItemIcon } from './MarketplaceItemIcon'
import { useMarketplaceAppAction } from './use-marketplace-app-action'

type Notice = { role: 'status' | 'alert'; message: string }

/** Lets one bot team use or not use each connected Marketplace app on this computer. */
export function MarketplaceTeamAccessDialog({
  team,
  open,
  onOpenChange
}: {
  team: BotTeam
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const apps = useAppStore((state) => state.marketplaceApps)
  const refresh = useAppStore((state) => state.refreshMarketplaceApps)
  const run = useMarketplaceAppAction()
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    if (open) {
      setNotice(null)
      void refresh()
    }
  }, [open, refresh])

  const changeTeam = (app: MarketplaceAppStatus, allowed: boolean): void => {
    const policy = app.access ?? everyoneAccessPolicy()
    const kept = withUnsupportedBotsKept(policy, withTeamAllowed(policy.bots, team, allowed), [
      team
    ])
    setNotice(
      kept.heldBack
        ? {
            role: 'status',
            message: translate(
              'auto.shared.marketplace-apps.agentDenialUnsupported',
              MARKETPLACE_AGENT_DENIAL_UNSUPPORTED_MESSAGE
            )
          }
        : null
    )
    const bots = kept.bots
    if (!bots) {
      return
    }
    // Why: switches stay disabled until the save lands, so a second edit never builds on a stale policy.
    setSaving(true)
    void run((api) => api.setAccessPolicy({ id: app.id, policy: { ...policy, bots } }))
      .then((outcome) => {
        if (!outcome.ok) {
          setNotice({ role: 'alert', message: outcome.message })
        }
      })
      .finally(() => setSaving(false))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BotTeamCharacterIcon character={team.character} size={16} still />
            {translate(
              'auto.components.marketplace.MarketplaceTeamAccessDialog.title',
              'Marketplace apps for {{team}}',
              { team: team.name }
            )}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.marketplace.MarketplaceTeamAccessDialog.description',
              "Choose which connected apps this team's bots can use."
            )}
          </DialogDescription>
        </DialogHeader>
        <AppList apps={apps} team={team} saving={saving} onChange={changeTeam} />
        {notice ? (
          <p
            role={notice.role}
            className={
              notice.role === 'alert' ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'
            }
          >
            {notice.message}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function AppList({
  apps,
  team,
  saving,
  onChange
}: {
  apps: MarketplaceAppsState
  team: BotTeam
  saving: boolean
  onChange: (app: MarketplaceAppStatus, allowed: boolean) => void
}): React.JSX.Element {
  if (apps.status === 'loading') {
    return (
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceTeamAccessDialog.loading',
          'Checking connected apps…'
        )}
      </p>
    )
  }
  if (apps.status === 'unavailable') {
    return (
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceTeamAccessDialog.unavailable',
          'Marketplace apps are not available here.'
        )}
      </p>
    )
  }
  if (apps.status === 'failed') {
    return (
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceTeamAccessDialog.failed',
          'Could not load connected apps.'
        )}
      </p>
    )
  }
  const connected = apps.apps.filter((app) => app.connected)
  if (connected.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceTeamAccessDialog.empty',
          'No apps are connected yet. Connect them from the Marketplace.'
        )}
      </p>
    )
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {connected.map((app) => {
        const name = MARKETPLACE_APP_INFO[app.id].name
        const allowed = marketplaceTeamAllowed(app.access ?? everyoneAccessPolicy(), team)
        return (
          <li key={app.id} className="flex items-center justify-between gap-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <MarketplaceItemIcon id={app.id} />
              <span className="truncate">{name}</span>
            </span>
            <Switch
              checked={allowed}
              disabled={saving}
              aria-label={translate(
                'auto.components.marketplace.MarketplaceTeamAccessDialog.switchLabel',
                'Let {{team}} use {{app}}',
                { team: team.name, app: name }
              )}
              onCheckedChange={(next) => onChange(app, next)}
            />
          </li>
        )
      })}
    </ul>
  )
}
