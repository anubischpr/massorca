import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { RateLimitWindow } from '../../../shared/rate-limit-types'
import {
  getDisplayedUsagePercentage,
  type UsagePercentageDisplay
} from '../../../shared/usage-percentage-display'
import {
  ProviderIcon,
  USAGE_URGENT_PERCENT,
  USAGE_WARNING_PERCENT,
  clampUsedPercent,
  getProviderDisplayName
} from '../components/status-bar/tooltip'
import { UsageRosterMenuContent } from '../components/status-bar/UsageRosterMenuContent'
import { useStatusBarController } from '../components/status-bar/use-status-bar-controller'
import { formatUsagePercentageLabel } from '../components/status-bar/usage-percentage-label'
import { getUsageRingWindows } from './usage-ring-windows'

const RING_BOX = 36
const OUTER_RADIUS = 16
const INNER_RADIUS = 12

function ringToneClass(used: number): string {
  if (used >= USAGE_URGENT_PERCENT) {
    return 'text-destructive'
  }
  return used >= USAGE_WARNING_PERCENT ? 'text-status-warning' : 'text-status-success'
}

function UsageRingArc({
  radius,
  usageWindow,
  display
}: {
  radius: number
  usageWindow: RateLimitWindow
  display: UsagePercentageDisplay
}): React.JSX.Element {
  const used = clampUsedPercent(usageWindow.usedPercent)
  const circumference = 2 * Math.PI * radius
  const filled = (circumference * getDisplayedUsagePercentage(used, display)) / 100
  const center = RING_BOX / 2
  return (
    <>
      <circle cx={center} cy={center} r={radius} className="stroke-border" />
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke="currentColor"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        className={ringToneClass(used)}
      />
    </>
  )
}

/** Usage rings at the bottom of the rail; a click opens the same Usage menu the status bar had. */
export function AppRailUsage(): React.JSX.Element | null {
  const controller = useStatusBarController(false, { ignoreStatusBarVisibility: true })
  if (!controller || controller.rosterProviders.length === 0) {
    return null
  }
  const display = controller.usagePercentageDisplay
  return (
    <DropdownMenu
      open={controller.usageMenuOpen}
      onOpenChange={controller.handleUsageMenuOpenChange}
      modal={false}
    >
      <DropdownMenuTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          aria-label={translate('auto.components.status.bar.UsageRosterPanel.title', 'Usage')}
          className="flex flex-col items-center gap-1 rounded-md"
        >
          {controller.rosterProviders.map((provider) => {
            const windows = getUsageRingWindows(provider)
            const name = getProviderDisplayName(provider.provider)
            return (
              <Tooltip key={provider.provider}>
                <TooltipTrigger asChild>
                  <span
                    data-usage-ring={provider.provider}
                    data-usage-ring-count={windows ? (windows.inner ? 2 : 1) : 0}
                    className="relative flex size-9 items-center justify-center rounded-full hover:bg-accent"
                  >
                    {windows ? (
                      <svg
                        viewBox={`0 0 ${RING_BOX} ${RING_BOX}`}
                        fill="none"
                        strokeWidth="2.5"
                        aria-hidden="true"
                        className="absolute inset-0 size-9 -rotate-90"
                      >
                        <UsageRingArc
                          radius={OUTER_RADIUS}
                          usageWindow={windows.outer}
                          display={display}
                        />
                        {windows.inner ? (
                          <UsageRingArc
                            radius={INNER_RADIUS}
                            usageWindow={windows.inner}
                            display={display}
                          />
                        ) : null}
                      </svg>
                    ) : null}
                    <ProviderIcon provider={provider.provider} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {windows
                    ? `${name} ${formatUsagePercentageLabel(clampUsedPercent(windows.outer.usedPercent), display)}`
                    : name}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="w-[360px] p-0"
        onPointerDownOutside={controller.usageMenuFocusHandoff.onPointerDownOutside}
        onCloseAutoFocus={controller.usageMenuFocusHandoff.onCloseAutoFocus}
      >
        <UsageRosterMenuContent controller={controller} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
