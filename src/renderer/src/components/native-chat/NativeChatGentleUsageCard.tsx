import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store'
import { useResetCountdownClock } from '@/hooks/useResetCountdownClock'
import { translate } from '@/i18n/i18n'
import { useEffectiveRateLimits } from '@/components/status-bar/use-effective-rate-limits'
import { clampUsedPercent, formatTimeAgo } from '@/components/status-bar/tooltip'
import { formatResetDuration } from '../../../../shared/rate-limit-reset-format'

/** The `/gentle:usage` panel, drawn from the NaN snapshot Orca already tracks; `fallback` when it has none. */
export function NativeChatGentleUsageCard({
  fallback
}: {
  fallback: React.JSX.Element
}): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const { rateLimits, refresh } = useEffectiveRateLimits(settings)
  const [refreshing, setRefreshing] = useState(false)
  const nan = rateLimits.nan
  const buckets = nan?.buckets ?? []
  const now = useResetCountdownClock(buckets.map((bucket) => bucket.resetsAt))
  if (!nan || nan.status === 'unavailable' || buckets.length === 0) {
    return fallback
  }
  const refreshLabel = translate('components.native-chat.gentleUsage.refresh', 'Refresh usage')
  return (
    <Card className="gap-3 py-3 shadow-xs">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm">
              {translate('components.native-chat.gentleUsage.title', 'Subscriptions')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {translate('components.native-chat.gentleUsage.updated', 'nan · updated {{time}}', {
                time: formatTimeAgo(nan.updatedAt)
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
          {buckets.map((bucket) => {
            const used = clampUsedPercent(bucket.usedPercent)
            const percent = String(Math.round(used))
            return (
              <div key={bucket.name} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate font-medium text-foreground">
                    {bucket.name}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {bucket.resetsAt === null
                      ? translate('components.native-chat.gentleUsage.used', '{{percent}}% used', {
                          percent
                        })
                      : translate(
                          'components.native-chat.gentleUsage.usedResets',
                          '{{percent}}% used · resets in {{duration}}',
                          { percent, duration: formatResetDuration(bucket.resetsAt - now) }
                        )}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={bucket.name}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(used)}
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-[var(--agent-gentle-shell-fg)]"
                    style={{ width: `${used}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
