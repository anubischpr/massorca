import { translate } from '@/i18n/i18n'
import { openPrototypeDesignSystem } from '../prototypes/open-prototype-design-system'
import { usePrototypeProposalOfRequest } from '../prototypes/use-prototype-set-for-request'

/** Under a request sent with "Propose one first": the design system it proposed, opening its Design system view. */
export function NativeChatPrototypeProposalLinkCard({
  requestId
}: {
  requestId: string
}): React.JSX.Element | null {
  const proposal = usePrototypeProposalOfRequest(requestId)
  if (proposal === null) {
    return null
  }
  return (
    <button
      type="button"
      data-native-chat-prototype-proposal-link-card="true"
      onClick={() => openPrototypeDesignSystem(proposal.projectKey)}
      className="flex w-[420px] max-w-full cursor-pointer items-center justify-between gap-3 self-start rounded-xl border border-border p-3 text-left text-sm text-foreground hover:bg-accent"
    >
      <span className="min-w-0 truncate">
        {translate('components.prototypes.link.proposed', 'Design system · proposed')}
      </span>
      <span className="shrink-0 text-muted-foreground">
        {translate('components.prototypes.link.review', 'Review ›')}
      </span>
    </button>
  )
}
