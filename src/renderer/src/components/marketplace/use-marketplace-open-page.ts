import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import type { MarketplaceItemId } from '@/store/slices/ui/ui-slice-contract-core'
import type { MarketplaceCustomItemStatus } from '../../../../shared/marketplace-custom'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { CatalogRow } from './MarketplaceCatalogRows'
import type { MarketplaceSkillListing, MarketplaceSkillPageData } from './MarketplaceSkillPageModel'
import { BUILT_IN_SKILL_COMMANDS, type BuiltInSkillCommand } from './marketplace-skill-built-in'
import type { MarketplaceIntegrationId } from './marketplace-integrations'
import {
  planMarketplaceRowPage,
  planSkillListingPage,
  skillPageOutcome,
  type MarketplaceRowBlockReason,
  type MarketplaceRowPagePlan
} from './marketplace-row-page-resolver'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

/**
 * A page a list opened: an agent, a Settings integration, a built-in command, a board tool, a custom
 * tool or agent (or the placeholder for them on a host), or a skill with the copies its page reads.
 */
export type MarketplaceOpenPage =
  | { kind: 'agent'; agent: TuiAgent }
  | { kind: 'integration'; id: MarketplaceIntegrationId }
  | { kind: 'built-in'; command: BuiltInSkillCommand }
  | { kind: 'board-tool'; row: CatalogRow }
  | { kind: 'custom-item'; item: MarketplaceCustomItemStatus }
  | { kind: 'custom-unavailable'; row: CatalogRow }
  | { kind: 'skill'; listing: MarketplaceSkillListing; page: MarketplaceSkillPageData }

export type MarketplaceOpenPageState = {
  openPage: MarketplaceOpenPage | null
  openRow: (row: CatalogRow) => void
  openSkillPage: (listing: MarketplaceSkillListing) => void
  closePage: () => void
}

type SkillPlan = Extract<MarketplaceRowPagePlan, { kind: 'skill' }>

function reportSkillOpenFailed(): void {
  toast.error(
    translate(
      'auto.components.marketplace.MarketplacePage.skillOpenFailed',
      'Could not open this skill.'
    )
  )
}

/** Why: an SSH host cannot list skills, so it is the one blocked row the person is told about. */
function reportBlockedRow(reason: MarketplaceRowBlockReason): void {
  if (reason === 'ssh-no-skill-scan') {
    reportSkillOpenFailed()
  }
}

// Why: a skill page opens after its scan, so a later open or close must cancel it.
function startSkillPage(
  plan: SkillPlan,
  openRequest: { current: number },
  setOpenPage: (page: MarketplaceOpenPage) => void
): void {
  const request = ++openRequest.current
  void plan.scan.then(
    (result) => {
      if (request !== openRequest.current) {
        return
      }
      const outcome = skillPageOutcome(plan.listing, result)
      if (outcome.opens) {
        setOpenPage({ kind: 'skill', listing: plan.listing, page: outcome.page })
      } else {
        reportSkillOpenFailed()
      }
    },
    () => {
      if (request === openRequest.current) {
        reportSkillOpenFailed()
      }
    }
  )
}

function openRowPage(
  row: CatalogRow,
  onOpenItem: (id: MarketplaceItemId) => void,
  setOpenPage: (page: MarketplaceOpenPage) => void
): void {
  const target = row.target
  if (target === null) {
    return
  }
  switch (target.kind) {
    // Why: skill rows open through their scan, never through this path.
    case 'skill':
    case 'custom-skill':
    case 'board-skill':
      return
    case 'item':
      onOpenItem(target.id)
      return
    case 'integration':
      setOpenPage({ kind: 'integration', id: target.id })
      return
    case 'built-in':
      setOpenPage({ kind: 'built-in', command: BUILT_IN_SKILL_COMMANDS[target.id] })
      return
    case 'agent':
      setOpenPage({ kind: 'agent', agent: target.agent })
      return
    case 'board-tool':
      setOpenPage({ kind: 'board-tool', row })
      return
    case 'custom-item':
      setOpenPage({ kind: 'custom-item', item: target.item })
      return
    case 'custom-unavailable':
      setOpenPage({ kind: 'custom-unavailable', row })
  }
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
      const plan = planSkillListingPage(listing, { pickedTarget, focusedRuntime: skillTarget })
      if (plan.kind === 'skill') {
        startSkillPage(plan, openRequest, setOpenPage)
      } else if (!plan.resolution.opens) {
        reportBlockedRow(plan.resolution.reason)
      }
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
      const plan = planMarketplaceRowPage(row, { pickedTarget, focusedRuntime: skillTarget })
      if (plan.kind === 'skill') {
        startSkillPage(plan, openRequest, setOpenPage)
        return
      }
      if (!plan.resolution.opens) {
        reportBlockedRow(plan.resolution.reason)
        return
      }
      openRequest.current += 1
      openRowPage(row, onOpenItem, setOpenPage)
    },
    [pickedTarget, skillTarget, onOpenItem]
  )

  // Why: a scan still in flight, such as the rescan a removal starts, must not reopen the page it left.
  const closePage = useCallback((): void => {
    openRequest.current += 1
    setOpenPage(null)
  }, [])

  return { openPage, openRow, openSkillPage, closePage }
}
