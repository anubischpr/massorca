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

export type MarketplacePerform = (api: MarketplaceAppsApi) => Promise<MarketplaceActionResult>
export type MarketplaceActionOutcome = { ok: true } | { ok: false; message: string }
export type RunMarketplaceAction = (
  perform: MarketplacePerform
) => Promise<MarketplaceActionOutcome>

/** Runs one Marketplace change, then refreshes the shared status so every surface agrees. */
export function useMarketplaceAppAction(): RunMarketplaceAction {
  const refresh = useAppStore((s) => s.refreshMarketplaceApps)
  return useCallback<RunMarketplaceAction>(
    async (perform) => {
      const api: MarketplaceAppsApi | undefined = window.api?.marketplaceApps
      if (!api) {
        return { ok: false, message: marketplaceUnavailableMessage() }
      }
      let outcome: MarketplaceActionOutcome
      try {
        const result = await perform(api)
        outcome = result.ok
          ? { ok: true }
          : { ok: false, message: marketplaceFailureMessage(result) }
      } catch {
        outcome = { ok: false, message: changeFailedMessage() }
      }
      await refresh()
      return outcome
    },
    [refresh]
  )
}
