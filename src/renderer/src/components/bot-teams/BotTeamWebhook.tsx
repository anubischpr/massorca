import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import {
  createBotTeamWebhook,
  replaceBotTeamWebhookSecret,
  type BotTeamWebhookMade
} from '@/runtime/runtime-bot-team-client-webhooks'
import { botTeamWebhookAddress } from '../../../../shared/bot-team-webhook-path'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotAgentIcon } from './BotAgentIcon'
import { routineAccessLabel } from './BotTeamRoutineLabels'
import { useBotTeamWebhooks } from './BotTeamWebhookSection'
import { BotTeamViewHeader } from './BotTeamViewHeader'

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

async function copy(text: string, done: string): Promise<void> {
  try {
    await window.api.ui.writeClipboardText(text)
    toast.success(done)
  } catch (error) {
    toast.error(errorText(error))
  }
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </>
  )
}

function CardRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-3 text-sm first:border-t-0">
      {children}
    </div>
  )
}

const HELP = 'text-xs text-muted-foreground'

/** Start a task from another app (board 43): the address, the key shown once, and what a call makes. */
export function BotTeamWebhook({
  team,
  webhookId,
  onBack
}: {
  team: BotTeam
  /** Absent: a new address is being made. */
  webhookId?: string
  onBack: () => void
}): React.JSX.Element {
  const listed = useBotTeamWebhooks(team.id)
  // The key lives here and nowhere else; leaving the page forgets it.
  const [made, setMade] = useState<BotTeamWebhookMade | null>(null)
  const [botId, setBotId] = useState(team.bots[0]?.id ?? '')
  const [confirmingReplace, setConfirmingReplace] = useState(false)
  const webhook =
    made?.webhook ??
    (listed && listed !== 'unavailable'
      ? listed.webhooks.find((entry) => entry.id === webhookId)
      : undefined)
  const endpoint =
    made?.endpoint ??
    (listed && listed !== 'unavailable' ? listed.endpoint : { state: 'unavailable' as const })
  const bot = team.bots.find((entry) => entry.id === (webhook?.botId ?? botId))

  const run = async (make: () => Promise<BotTeamWebhookMade>): Promise<void> => {
    try {
      setMade(await make())
      setConfirmingReplace(false)
    } catch (error) {
      toast.error(errorText(error))
    }
  }
  const address = webhook ? botTeamWebhookAddress(endpoint, team.name, webhook.id) : ''
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BotTeamViewHeader
        title={translate('components.botTeams.webAddressTitle', 'Start a task from another app')}
        detail={team.name}
        backLabel={translate('components.botTeams.routines', 'Routines')}
        onBack={onBack}
      />
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[736px] flex-col gap-5 px-4 py-8">
          <div>
            <h1 className="text-xl font-semibold">
              {translate('components.botTeams.webAddressTitle', 'Start a task from another app')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {translate(
                'components.botTeams.webAddressHelp',
                'Another app calls this web address, a webhook. One task starts in {{team}}, and no other step is needed.',
                { team: team.name }
              )}
            </p>
          </div>
          {endpoint.state === 'unavailable' ? (
            <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <div className="font-medium">
                {translate(
                  'components.botTeams.webAddressOffTitle',
                  'This host does not take calls yet'
                )}
              </div>
              <div className={HELP}>
                {translate(
                  'components.botTeams.webAddressOffHelp',
                  'The address and key are saved, but no other app can reach them until this host opens a way in. Nothing is started by a call today.'
                )}
              </div>
            </div>
          ) : null}
          {webhook ? (
            <>
              <Section title={translate('components.botTeams.webAddress', 'Web address')}>
                <div className="flex flex-col rounded-xl border border-border bg-card">
                  <CardRow>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{address}</span>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() =>
                        void copy(address, translate('components.botTeams.copied', 'Copied'))
                      }
                    >
                      {translate('components.botTeams.copy', 'Copy')}
                    </Button>
                  </CardRow>
                </div>
                <p className={HELP}>
                  {translate(
                    'components.botTeams.webAddressSends',
                    'The other app sends its text to this address. The text becomes the task.'
                  )}
                </p>
              </Section>
              <Section title={translate('components.botTeams.secretKey', 'Secret key')}>
                {made ? (
                  <>
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
                      <span className="min-w-0 flex-1">
                        {translate(
                          'components.botTeams.secretShownOnce',
                          "Shown once. Copy it now and keep it somewhere safe. You won't see it again."
                        )}
                      </span>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() =>
                          void copy(
                            made.secret,
                            translate('components.botTeams.keyCopied', 'Key copied')
                          )
                        }
                      >
                        {translate('components.botTeams.copyKey', 'Copy key')}
                      </Button>
                    </div>
                    <div className="flex flex-col rounded-xl border border-border bg-card">
                      <CardRow>
                        <span className="min-w-0 flex-1 break-all font-mono text-xs">
                          {made.secret}
                        </span>
                        <Badge variant="secondary">
                          {translate('components.botTeams.shownOnce', 'Shown once')}
                        </Badge>
                      </CardRow>
                    </div>
                    <p className={HELP}>
                      {translate(
                        'components.botTeams.secretLost',
                        'If you lose it, replace the key. The old one stops working.'
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col rounded-xl border border-border bg-card">
                      <CardRow>
                        <span className="min-w-0 flex-1">
                          <span className="block">
                            {translate('components.botTeams.secretHidden', 'The key is hidden')}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {translate(
                              'components.botTeams.secretHiddenHelp',
                              'It was shown once, when this address was made. Only a fingerprint is kept.'
                            )}
                          </span>
                        </span>
                        {confirmingReplace ? null : (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setConfirmingReplace(true)}
                          >
                            {translate('components.botTeams.replaceKey', 'Replace key')}
                          </Button>
                        )}
                      </CardRow>
                    </div>
                    {confirmingReplace ? (
                      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3">
                        <p className="text-sm">
                          {translate(
                            'components.botTeams.replaceKeyWarning',
                            'The old key stops working at once. The other app must use the new one.'
                          )}
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmingReplace(false)}
                          >
                            {translate('components.botTeams.cancel', 'Cancel')}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => void run(() => replaceBotTeamWebhookSecret(webhook.id))}
                          >
                            {translate('components.botTeams.replaceKey', 'Replace key')}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </Section>
            </>
          ) : webhookId === undefined ? (
            <div className="flex flex-col gap-1.5">
              <Label>{translate('components.botTeams.routineBot', 'Bot')}</Label>
              <div className="flex flex-wrap gap-1.5">
                {team.bots.map((entry) => (
                  <Button
                    key={entry.id}
                    variant={entry.id === botId ? 'secondary' : 'outline'}
                    size="sm"
                    aria-pressed={entry.id === botId}
                    onClick={() => setBotId(entry.id)}
                  >
                    <BotAgentIcon agent={entry.agent} size={16} />
                    {entry.name}
                  </Button>
                ))}
              </div>
              {bot?.job ? <p className={HELP}>{bot.job}</p> : null}
            </div>
          ) : null}
          <Section title={translate('components.botTeams.whatItCreates', 'What it creates')}>
            <div className="flex flex-col rounded-xl border border-border bg-card">
              <CardRow>
                <span className="flex-1 text-muted-foreground">
                  {translate('components.botTeams.webAddressTask', 'Task')}
                </span>
                <span>
                  {translate(
                    'components.botTeams.webAddressTaskValue',
                    'One task in {{team}}’s board, in progress, with its own thread',
                    { team: team.name }
                  )}
                </span>
              </CardRow>
              <CardRow>
                <span className="flex-1 text-muted-foreground">
                  {translate('components.botTeams.routineBot', 'Bot')}
                </span>
                <span className="flex items-center gap-2">
                  <BotAgentIcon agent={bot?.agent} size={16} />
                  {translate('components.botTeams.webAddressBotValue', '{{bot}}, with {{access}}', {
                    bot: bot?.name ?? '',
                    access: routineAccessLabel(team).toLowerCase()
                  })}
                </span>
              </CardRow>
              <CardRow>
                <span className="flex-1 text-muted-foreground">
                  {translate('components.botTeams.webAddressEach', 'Each call')}
                </span>
                <span>
                  {translate(
                    'components.botTeams.webAddressEachValue',
                    'One task. No routine and no schedule'
                  )}
                </span>
              </CardRow>
            </div>
          </Section>
          <div className="flex justify-end gap-2">
            {webhook ? (
              <Button onClick={onBack}>{translate('components.botTeams.done', 'Done')}</Button>
            ) : webhookId === undefined ? (
              <>
                <Button variant="ghost" onClick={onBack}>
                  {translate('components.botTeams.cancel', 'Cancel')}
                </Button>
                <Button
                  disabled={!bot}
                  onClick={() => void run(() => createBotTeamWebhook({ teamId: team.id, botId }))}
                >
                  {translate('components.botTeams.createWebAddress', 'Create web address')}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
