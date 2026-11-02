import { useEffect, useState } from 'react'
import { Plug } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import {
  listBotTeamWebhooks,
  type BotTeamWebhookList
} from '@/runtime/runtime-bot-team-client-webhooks'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { routineDateLabel } from './BotTeamRoutineLabels'

/** The team's web addresses on its host; 'unavailable' is a host from before them. */
export function useBotTeamWebhooks(teamId: string): BotTeamWebhookList | 'unavailable' | null {
  const [listed, setListed] = useState<BotTeamWebhookList | 'unavailable' | null>(null)
  useEffect(() => {
    let closed = false
    void listBotTeamWebhooks(teamId).then(
      (next) => !closed && setListed(next),
      (error: unknown) => toast.error(error instanceof Error ? error.message : String(error))
    )
    return () => {
      closed = true
    }
  }, [teamId])
  return listed
}

/** Web addresses (the lower half of boards 39 and 40): another app can start a task by calling one. */
export function BotTeamWebhookSection({
  team,
  onOpen
}: {
  team: BotTeam
  /** No id means making a new one. */
  onOpen: (webhookId?: string) => void
}): React.JSX.Element {
  const listed = useBotTeamWebhooks(team.id)
  return (
    <>
      <h2 className="text-lg font-semibold">
        {translate('components.botTeams.webAddresses', 'Web addresses')}
      </h2>
      {listed === 'unavailable' ? (
        <p className="text-sm text-muted-foreground">
          {translate(
            'components.botTeams.webAddressesUnavailable',
            'This host cannot make web addresses yet.'
          )}
        </p>
      ) : listed === null ? null : listed.webhooks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-8 text-center">
          <h3 className="text-base font-semibold">
            {translate('components.botTeams.noWebAddresses', 'No web addresses yet')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {translate(
              'components.botTeams.noWebAddressesHelp',
              'Another app can call a web address, a webhook, to start one task in {{team}}.',
              { team: team.name }
            )}
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpen()}>
            {translate('components.botTeams.newWebAddress', 'New web address')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col rounded-xl border border-border bg-card">
          {listed.webhooks.map((webhook) => {
            const bot = team.bots.find((entry) => entry.id === webhook.botId)
            return (
              <div
                key={webhook.id}
                className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0"
              >
                <Plug className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {translate(
                      'components.botTeams.webAddressTitle',
                      'Start a task from another app'
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {webhook.lastCall
                      ? translate(
                          'components.botTeams.webAddressLastCall',
                          '{{bot}}. One task for each call. Last call {{when}}.',
                          { bot: bot?.name ?? '', when: routineDateLabel(webhook.lastCall) }
                        )
                      : translate(
                          'components.botTeams.webAddressNoCalls',
                          '{{bot}}. One task for each call. No calls yet.',
                          { bot: bot?.name ?? '' }
                        )}
                  </span>
                  {listed.endpoint.state === 'unavailable' ? (
                    <span className="block text-xs text-muted-foreground">
                      {translate(
                        'components.botTeams.webAddressNotReceiving',
                        'This host does not take calls yet.'
                      )}
                    </span>
                  ) : null}
                </span>
                <Button variant="outline" size="xs" onClick={() => onOpen(webhook.id)}>
                  {translate('components.botTeams.open', 'Open')}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
