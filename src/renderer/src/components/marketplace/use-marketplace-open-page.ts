import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import type { MarketplaceItemId } from '@/store/slices/ui/ui-slice-contract-core'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { skillAgentByRootPath } from '../skills/skill-agent-filter'
import type { CatalogRow } from './MarketplaceCatalogRows'
import {
  marketplaceSkillPageFromScan,
  type MarketplaceSkillListing,
  type MarketplaceSkillPageData
} from './MarketplaceSkillPageModel'
import { BUILT_IN_SKILL_COMMANDS, type BuiltInSkillCommand } from './marketplace-skill-built-in'
import { discoverSkillsForPickedHost } from './marketplace-skill-host-scan'
import type { MarketplaceIntegrationId } from './marketplace-integrations'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

/** A page a list opened: an agent, a Settings integration, a built-in command, or a skill with the copies its page reads. */
export type MarketplaceOpenPage =
  | { kind: 'agent'; agent: TuiAgent }
  | { kind: 'integration'; id: MarketplaceIntegrationId }
  | { kind: 'built-in'; command: BuiltInSkillCommand }
  | { kind: 'skill'; listing: MarketplaceSkillListing; page: MarketplaceSkillPageData }

export type MarketplaceOpenPageState = {
  openPage: MarketplaceOpenPage | null
  openRow: (row: CatalogRow) => void
  openSkillPage: (listing: MarketplaceSkillListing) => void
  closePage: () => void
}

function reportSkillOpenFailed(): void {
  toast.error(
    translate(
      'auto.components.marketplace.MarketplacePage.skillOpenFailed',
      'Could not open this skill.'
    )
  )
}

/**
 * The page a catalog row opens, shared by the Marketplace view and its Settings pane.
 * Why: an app row is the caller's to open, since the view keeps it in the store and the pane locally.
 */
export function useMarketplaceOpenPage({
  pickedTarget,
  hostKey,
  skillTarget,
  onOpenItem
}: {
  pickedTarget: MarketplaceVaultHostTarget | null
  hostKey: string | null
  skillTarget: RuntimeClientTarget | null
  onOpenItem: (id: MarketplaceItemId) => void
}): MarketplaceOpenPageState {
  const [openPage, setOpenPage] = useState<MarketplaceOpenPage | null>(null)
  // Why: a skill page opens after its scan, so a later open or close must cancel it.
  const openRequest = useRef(0)

  // Why: the catalog keeps only the skill list, so the page takes one fresh scan for the copies it shows.
  const openSkillPage = useCallback(
    (listing: MarketplaceSkillListing): void => {
      const scan = discoverSkillsForPickedHost(pickedTarget, skillTarget)
      if (scan === null) {
        if (pickedTarget !== null) {
          reportSkillOpenFailed()
        }
        return
      }
      const request = ++openRequest.current
      void scan.then(
        (result) => {
          if (request !== openRequest.current) {
            return
          }
          const page = marketplaceSkillPageFromScan(
            listing,
            result.skills,
            skillAgentByRootPath(result)
          )
          if (page === null) {
            reportSkillOpenFailed()
            return
          }
          setOpenPage({ kind: 'skill', listing, page })
        },
        () => {
          if (request === openRequest.current) {
            reportSkillOpenFailed()
          }
        }
      )
    },
    [pickedTarget, skillTarget]
  )

  // Why: the open skill page's host picker moves its scan to the newly picked host, so it is read again.
  const openPageRef = useRef<MarketplaceOpenPage | null>(null)
  useEffect(() => {
    openPageRef.current = openPage
  }, [openPage])
  const scannedHostKey = useRef(hostKey)
  useEffect(() => {
    if (scannedHostKey.current === hostKey) {
      return
    }
    scannedHostKey.current = hostKey
    const open = openPageRef.current
    if (open?.kind === 'skill') {
      setOpenPage(null)
      openSkillPage(open.listing)
    }
  }, [hostKey, openSkillPage])

  const openRow = useCallback(
    (row: CatalogRow): void => {
      const target = row.target
      if (target === null) {
        return
      }
      if (target.kind === 'skill') {
        openSkillPage({ kind: 'discovered', skill: target.skill })
        return
      }
      if (target.kind === 'custom-skill') {
        openSkillPage({ kind: 'custom', item: target.item })
        return
      }
      openRequest.current += 1
      if (target.kind === 'item') {
        onOpenItem(target.id)
      } else if (target.kind === 'integration') {
        setOpenPage({ kind: 'integration', id: target.id })
      } else if (target.kind === 'built-in') {
        setOpenPage({ kind: 'built-in', command: BUILT_IN_SKILL_COMMANDS[target.id] })
      } else {
        setOpenPage({ kind: 'agent', agent: target.agent })
      }
    },
    [openSkillPage, onOpenItem]
  )

  // Why: a scan still in flight, such as the rescan a removal starts, must not reopen the page it left.
  const closePage = useCallback((): void => {
    openRequest.current += 1
    setOpenPage(null)
  }, [])

  return { openPage, openRow, openSkillPage, closePage }
}
