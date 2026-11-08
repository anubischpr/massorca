import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  MarketplaceCustomApi,
  MarketplaceCustomItemStatus
} from '../../../../shared/marketplace-custom'

/** Fired after a custom item is added or installed, so every list of them reloads. */
export const MARKETPLACE_CUSTOM_CHANGED_EVENT = 'orca:marketplace-custom-changed'

export function notifyMarketplaceCustomChanged(): void {
  window.dispatchEvent(new Event(MARKETPLACE_CUSTOM_CHANGED_EVENT))
}

export type MarketplaceCustomItems = {
  /** Null until the first list arrives. */
  items: readonly MarketplaceCustomItemStatus[] | null
  installingIds: ReadonlySet<string>
  install: (id: string) => Promise<void>
  /** Forgets the item in the Marketplace list; the program it checks is left alone. */
  remove: (id: string) => Promise<boolean>
}

/** The custom tools and agents the person added by hand, read from the desktop bridge. */
export function useMarketplaceCustomItems(): MarketplaceCustomItems {
  const api: MarketplaceCustomApi | undefined = window.api?.marketplaceCustom
  const [items, setItems] = useState<readonly MarketplaceCustomItemStatus[] | null>(() =>
    api === undefined ? [] : null
  )
  const [installingIds, setInstallingIds] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    if (api === undefined) {
      return
    }
    let active = true
    const load = (): void => {
      void api.list().then(
        (list) => {
          if (active) {
            setItems(list)
          }
        },
        () => {
          if (active) {
            setItems([])
          }
        }
      )
    }
    load()
    window.addEventListener(MARKETPLACE_CUSTOM_CHANGED_EVENT, load)
    return () => {
      active = false
      window.removeEventListener(MARKETPLACE_CUSTOM_CHANGED_EVENT, load)
    }
  }, [api])

  const install = useCallback(
    async (id: string): Promise<void> => {
      if (api === undefined) {
        return
      }
      setInstallingIds((current) => new Set(current).add(id))
      try {
        const result = await api.install({ id })
        if (!result.ok) {
          toast.error(
            translate(
              'auto.components.marketplace.MarketplaceCatalogCustom.installFailed',
              'Could not install this app.'
            )
          )
        }
      } catch {
        toast.error(
          translate(
            'auto.components.marketplace.MarketplaceCatalogCustom.installFailed',
            'Could not install this app.'
          )
        )
      } finally {
        setInstallingIds((current) => {
          const next = new Set(current)
          next.delete(id)
          return next
        })
        notifyMarketplaceCustomChanged()
      }
    },
    [api]
  )

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (api === undefined) {
        return false
      }
      try {
        const result = await api.remove({ id })
        return result.ok
      } catch {
        return false
      } finally {
        notifyMarketplaceCustomChanged()
      }
    },
    [api]
  )

  return { items, installingIds, install, remove }
}
