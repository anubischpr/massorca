import { useCallback } from 'react'
import { useAppStore } from '@/store'
import type {
  MarketplaceActionResult,
  MarketplaceAppsApi
} from '../../../../shared/marketplace-apps'
import {
  changeFailedMessage,
  marketplaceFailureMessage,
  marketplaceUnavailableMessage
} from './marketplace-action-messages'
import type { MarketplaceHostScope } from './use-marketplace-app-host'

export type MarketplacePerform = (api: MarketplaceAppsApi) => Promise<MarketplaceActionResult>
export type MarketplaceActionOutcome = { ok: true } | { ok: false; message: string }
export type RunMarketplaceAction = (
  perform: MarketplacePerform
) => Promise<MarketplaceActionOutcome>

/**
 * Runs one Marketplace change, then refreshes the status so every surface agrees: this computer's
 * shared copy, or the picked host's own list when `scope` aims the page at another host.
 */
export function useMarketplaceAppAction(
  scope: MarketplaceHostScope | null = null
): RunMarketplaceAction {
  const refresh = useAppStore((s) => s.refreshMarketplaceApps)
  return useCallback<RunMarketplaceAction>(
    async (perform) => {
      const api: MarketplaceAppsApi | undefined = scope ? scope.api : window.api?.marketplaceApps
      if (!api) {
        return { ok: false, message: marketplaceUnavailableMessage() }
      }
      let outcome: MarketplaceActionOutcome
      try {
        const result = await perform(api)
        outcome = result.ok
          ? { ok: true }
          : { ok: false, message: marketplaceFailureMessage(result, scope?.label) }
      } catch {
        outcome = { ok: false, message: changeFailedMessage() }
      }
      await (scope ? scope.reload() : refresh())
      return outcome
    },
    [refresh, scope]
  )
}
