import React from 'react'
import { translate } from '@/i18n/i18n'
import { ClaudeSwitcherMenu } from './ClaudeSwitcherMenu'
import { CodexSwitcherMenu } from './CodexSwitcherMenu'
import { ProviderDetailsMenu } from './ProviderDetailsMenu'
import { UsageRosterPanel } from './UsageRosterPanel'
import { getUsageProviderAccountsSectionId } from './usage-provider-settings-target'
import type { StatusBarController } from './use-status-bar-controller'

export function UsageRosterMenuContent({
  controller
}: {
  controller: StatusBarController
}): React.JSX.Element {
  const {
    anyFetching,
    compact,
    handleManageAccounts,
    handleOpenProviderAccounts,
    handleRefresh,
    handleUsageDetails,
    isRefreshing,
    rosterProviders,
    setStatusBarUsageMode,
    statusBarUsageMode,
    usageHostLabel,
    usagePercentageDisplay
  } = controller
  return (
    <UsageRosterPanel
      providers={rosterProviders}
      sourceLabel={usageHostLabel}
      display={usagePercentageDisplay}
      statusBarUsageMode={statusBarUsageMode}
      onStatusBarUsageModeChange={setStatusBarUsageMode}
      isRefreshing={isRefreshing || anyFetching}
      onRefresh={handleRefresh}
      onOpenProvider={handleOpenProviderAccounts}
      onSignIn={handleOpenProviderAccounts}
      canSignIn={(provider) => getUsageProviderAccountsSectionId(provider) !== null}
      onManageAccounts={handleManageAccounts}
      onUsageDetails={handleUsageDetails}
      renderRow={(p, rowNode) => {
        // Every provider drills into its detail panel (parity with the
        // per-provider dropdowns on main); Claude/Codex additionally get
        // the account switcher + runtime toggle + Codex reset credits.
        if (p.provider === 'claude') {
          return (
            <ClaudeSwitcherMenu
              claude={p}
              compact={compact}
              iconOnly={false}
              asSubmenu
              triggerContent={rowNode}
            />
          )
        }
        if (p.provider === 'codex') {
          return (
            <CodexSwitcherMenu
              codex={p}
              compact={compact}
              iconOnly={false}
              asSubmenu
              triggerContent={rowNode}
            />
          )
        }
        return (
          <ProviderDetailsMenu
            provider={p}
            compact={compact}
            iconOnly={false}
            asSubmenu
            triggerContent={rowNode}
            ariaLabel={translate(
              'auto.components.status.bar.UsageRosterPanel.openDetails',
              'Open usage details'
            )}
          />
        )
      }}
    />
  )
}
