import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAppStore } from '@/store'
import { useResetCountdownClock } from '@/hooks/useResetCountdownClock'
import { translate } from '@/i18n/i18n'
import { useEffectiveRateLimits } from '@/components/status-bar/use-effective-rate-limits'
import { clampUsedPercent, formatTimeAgo, getWindowSections } from '@/components/status-bar/tooltip'
import { formatResetDuration } from '../../../../shared/rate-limit-reset-format'

/** The `/usage` row for Codex, drawn from the account snapshot Orca already tracks; `fallback`
 *  when that snapshot holds no Codex windows. */
export function NativeChatCodexUsageCard({
  fallback
}: {
  fallback: React.JSX.Element
}): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const { rateLimits, refresh } = useEffectiveRateLimits(settings)
  const [refreshing, setRefreshing] = useState(false)
  const codex = rateLimits.codex
  const windows = useMemo(
    () =>
      codex && codex.status !== 'unavailable'
        ? getWindowSections(codex).flatMap(({ label, window }) =>
            window ? [{ label, window }] : []
          )
        : [],
    [codex]
  )
  const now = useResetCountdownClock(
    useMemo(() => windows.map((entry) => entry.window.resetsAt), [windows])
  )
  if (!codex || windows.length === 0) {
    return fallback
  }
  const refreshLabel = translate('components.native-chat.codexUsage.refresh', 'Refresh usage')
  return (
    <Card className="gap-3 py-3 shadow-xs">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm">
              {translate('components.native-chat.codexUsage.title', 'Codex usage')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {translate('components.native-chat.codexUsage.updated', 'Updated {{time}}', {
                time: formatTimeAgo(codex.updatedAt)
              })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={refreshLabel}
            title={refreshLabel}
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true)
              void refresh().finally(() => setRefreshing(false))
            }}
          >
            <RefreshCw aria-hidden="true" className={refreshing ? 'animate-spin' : undefined} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {windows.map(({ label, window }) => {
            const used = clampUsedPercent(window.usedPercent)
            const percent = String(Math.round(used))
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate font-medium text-foreground">{label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {window.resetsAt === null
                      ? translate('components.native-chat.codexUsage.used', '{{percent}}% used', {
                          percent
                        })
                      : translate(
                          'components.native-chat.codexUsage.usedResets',
                          '{{percent}}% used · resets in {{duration}}',
                          { percent, duration: formatResetDuration(window.resetsAt - now) }
                        )}
                  </span>
                </div>
                <Progress value={used} aria-label={label} className="h-1.5" />
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
