import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { MarketplaceAgentPage } from './MarketplaceAgentPage'
import { MarketplaceIntegrationPage } from './MarketplaceIntegrationPage'
import { MarketplaceSkillBuiltInPage } from './MarketplaceSkillBuiltInPage'
import { MarketplaceSkillPage } from './MarketplaceSkillPage'
import type { MarketplaceOpenPageState } from './use-marketplace-open-page'

/** The page a catalog row opened, the same in the Marketplace view and its Settings pane. */
export function MarketplaceOpenPageView({
  state,
  hostLabel,
  skillTarget
}: {
  state: MarketplaceOpenPageState
  hostLabel: string
  skillTarget: RuntimeClientTarget | null
}): React.JSX.Element | null {
  const { openPage, closePage, openSkillPage } = state
  if (openPage === null) {
    return null
  }
  switch (openPage.kind) {
    case 'agent':
      return <MarketplaceAgentPage agentId={openPage.agent} onBack={closePage} />
    case 'integration':
      return <MarketplaceIntegrationPage integration={openPage.id} onBack={closePage} />
    case 'built-in':
      return <MarketplaceSkillBuiltInPage command={openPage.command} onBack={closePage} />
    case 'skill':
      return (
        <MarketplaceSkillPage
          skill={openPage.page.skill}
          copies={openPage.page.copies}
          hostName={hostLabel}
          focusedRuntime={skillTarget}
          onBack={closePage}
          onRescan={() => openSkillPage(openPage.listing)}
        />
      )
  }
}
