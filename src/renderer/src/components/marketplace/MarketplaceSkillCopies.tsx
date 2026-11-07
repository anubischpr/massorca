import { translate } from '@/i18n/i18n'
import type { DiscoveredSkill } from '../../../../shared/skills'
import { skillDeleteEligibilityReason } from '../skills/skill-delete-selection'
import { MarketplaceCard, MarketplaceCardLabel, MarketplaceCardRow } from './MarketplaceDetail'

/** Every copy of the skill on the host, with the folder it sits in and why a copy cannot be removed, when it cannot. */
export function MarketplaceSkillCopies({
  copies,
  hostName
}: {
  copies: readonly DiscoveredSkill[]
  hostName: string
}): React.JSX.Element | null {
  if (copies.length === 0) {
    return null
  }
  return (
    <section data-marketplace-skill-copies>
      <MarketplaceCardLabel>
        {translate(
          'auto.components.marketplace.MarketplaceSkillCopies.label',
          'Copies on {{host}}',
          { host: hostName }
        )}
      </MarketplaceCardLabel>
      <MarketplaceCard>
        {copies.map((copy) => {
          const reason = skillDeleteEligibilityReason(copy)
          return (
            <MarketplaceCardRow
              key={copy.id}
              name={copy.sourceLabel}
              description={copy.directoryPath}
              mono
            >
              {reason === null ? null : (
                <span className="text-xs text-muted-foreground">{reason}</span>
              )}
            </MarketplaceCardRow>
          )
        })}
      </MarketplaceCard>
    </section>
  )
}
