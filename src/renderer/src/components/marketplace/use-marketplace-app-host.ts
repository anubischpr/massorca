import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import type { MarketplaceAppsState } from '@/store/slices/ui/ui-slice-contract-core'
import type { MarketplaceAppsApi } from '../../../../shared/marketplace-apps'
import { createHostMarketplaceAppsApi, readHostApps } from './marketplace-apps-host-client'
import { vaultHostFailureMessage } from './marketplace-vault-credential-text'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import { marketplaceHostKey, useMarketplaceHostTargets } from './use-marketplace-host-targets'

/** The host the page is aimed at, when it is not this computer. */
export type MarketplaceHostScope = {
  label: string
  api: MarketplaceAppsApi
  reload: () => Promise<void>
}

export type MarketplaceAppHost = {
  /** Hosts the person can pick besides this computer. */
  targets: MarketplaceVaultHostTarget[]
  /** Key of the picked host; null is this computer. */
  selectedKey: string | null
  select: (key: string | null) => void
  /** Status of the picked host's apps, or this computer's shared copy. */
  apps: MarketplaceAppsState
  /** Why the picked host could not be read, in plain words. */
  failure: string | null
  /** Set only while another host is picked. */
  scope: MarketplaceHostScope | null
  retry: () => void
}

type RemoteApps = { key: string | null; state: MarketplaceAppsState; failure: string | null }

const LOADING: RemoteApps = { key: null, state: { status: 'loading' }, failure: null }

/** Aims the app page at this computer or one of the hosts that run agents of their own. */
export function useMarketplaceAppHost(): MarketplaceAppHost {
  const targets = useMarketplaceHostTargets()
  const localApps = useAppStore((s) => s.marketplaceApps)
  const refreshLocal = useAppStore((s) => s.refreshMarketplaceApps)
  // Why: the pick lives in the persisted UI store so leaving Marketplace and restarting keep it.
  const pickedKey = useAppStore((s) => s.marketplaceHostKey)
  const setPickedKey = useAppStore((s) => s.setMarketplaceHostKey)
  const [remote, setRemote] = useState<RemoteApps>(LOADING)

  // Why: a host that disconnects while picked shows this computer, but the saved key stays so the pick returns on reconnect.
  const target = useMemo(
    () => (pickedKey ? (targets.find((t) => marketplaceHostKey(t) === pickedKey) ?? null) : null),
    [pickedKey, targets]
  )

  const reload = useCallback(async (): Promise<void> => {
    if (!target) {
      return
    }
    const key = marketplaceHostKey(target)
    const result = await readHostApps(target)
    setRemote(
      result.ok
        ? { key, state: { status: 'ready', apps: result.apps }, failure: null }
        : {
            key,
            state: { status: 'failed' },
            failure: vaultHostFailureMessage(result.reason, target.label)
          }
    )
  }, [target])

  useEffect(() => {
    if (!target) {
      return
    }
    void reload()
  }, [target, reload])

  const selectedKey = target ? marketplaceHostKey(target) : null
  // Why: a host just picked shows as checking, never as the previous host's answer.
  const shown = remote.key === selectedKey ? remote : LOADING

  const scope = useMemo<MarketplaceHostScope | null>(
    () =>
      target ? { label: target.label, api: createHostMarketplaceAppsApi(target), reload } : null,
    [target, reload]
  )

  return {
    targets,
    selectedKey,
    select: setPickedKey,
    apps: target ? shown.state : localApps,
    failure: target ? shown.failure : null,
    scope,
    retry: () => void (target ? reload() : refreshLocal())
  }
}
