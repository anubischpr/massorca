import { SkillsPageContent } from '../skills/SkillsPage'

/** The Skills page's content as the Marketplace's Skills section; its close control leaves the section. */
export function MarketplaceSkillsSection({ onClose }: { onClose: () => void }): React.JSX.Element {
  return <SkillsPageContent onClose={onClose} />
}
