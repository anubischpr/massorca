import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useResetCountdownClock } from '@/hooks/useResetCountdownClock'
import { clampUsedPercent } from '@/components/status-bar/tooltip'
import { formatResetDuration } from '../../../../shared/rate-limit-reset-format'

export type NativeChatUsageWindow = {
  label: string
  usedPercent: number
  /** Unix ms; null when the provider reports no reset. */
  resetsAt: number | null
}

/** The card both usage rows share: a title, a refresh, and one bar per window with its reset
 *  countdown. Each caller words its own strings and picks its bar color. */
export function NativeChatUsageWindowsCard(props: {
  title: string
  subtitle: string
  refreshLabel: string
  refresh: () => Promise<void>
  windows: readonly NativeChatUsageWindow[]
  /** The bar fill, a class naming a token color. */
  barClassName: string
  used: (percent: string) => string
  usedResets: (percent: string, duration: string) => string
}): React.JSX.Element {
  const [refreshing, setRefreshing] = useState(false)
  const now = useResetCountdownClock(props.windows.map((entry) => entry.resetsAt))
  return (
    <Card className="gap-3 py-3 shadow-xs">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle>{props.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{props.subtitle}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={props.refreshLabel}
            title={props.refreshLabel}
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true)
              void props.refresh().finally(() => setRefreshing(false))
            }}
          >
            <RefreshCw aria-hidden="true" className={refreshing ? 'animate-spin' : undefined} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {props.windows.map((window) => {
            const used = clampUsedPercent(window.usedPercent)
            const percent = String(Math.round(used))
            return (
              <div key={window.label} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate font-medium text-foreground">
                    {window.label}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {window.resetsAt === null
                      ? props.used(percent)
                      : props.usedResets(percent, formatResetDuration(window.resetsAt - now))}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={window.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(used)}
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={`h-full rounded-full ${props.barClassName}`}
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
