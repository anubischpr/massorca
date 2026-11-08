import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { MarketplaceAppSection } from './MarketplaceAppSection'
import {
  MarketplaceBreadcrumb,
  MarketplaceCard,
  MarketplaceCardLabel,
  MarketplaceCardRow,
  MarketplaceItemHeader
} from './MarketplaceDetail'
import { MarketplaceFunctionNote } from './MarketplaceFunctionNote'
import { MarketplaceIntegrationAdvanced } from './MarketplaceIntegrationAdvanced'
import { MarketplacePageHostRow } from './MarketplacePageHostRow'
import type { BuiltInSkillCommand } from './marketplace-skill-built-in'
import { skillDisplayName } from './marketplace-skill-display-name'
import { useMarketplaceAppHost } from './use-marketplace-app-host'

/** A command MassOrca builds in: what it is, that nothing installs or removes it, and its Settings pane when it has one. */
export function MarketplaceSkillBuiltInPage({
  command,
  onBack
}: {
  command: BuiltInSkillCommand
  onBack: () => void
}): React.JSX.Element {
  const openSettingsPage = useAppStore((state) => state.openSettingsPage)
  const openSettingsTarget = useAppStore((state) => state.openSettingsTarget)
  const name = skillDisplayName(command.name)
  const settingsPane = command.settingsPane
  const host = useMarketplaceAppHost()

  const openSettings = (pane: 'orchestration'): void => {
    openSettingsTarget({ pane, repoId: null })
    openSettingsPage()
  }

  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex max-w-4xl flex-col gap-6 py-4')}>
      <MarketplacePageHostRow host={host}>
        <MarketplaceBreadcrumb name={name} onBack={onBack} />
      </MarketplacePageHostRow>
      <MarketplaceItemHeader
        icon={<BookOpen className="size-6" aria-hidden />}
        name={name}
        description={translate(command.description.key, command.description.fallback)}
        statusTone="ok"
        status={translate(
          'auto.components.marketplace.MarketplaceSkillBuiltInPage.builtIn',
          'Built into MassOrca'
        )}
      />
      <MarketplaceFunctionNote part="install">
        {translate(
          'auto.components.marketplace.MarketplaceSkillBuiltInPage.noInstall',
          'Built into this version of MassOrca, so no host installs it.'
        )}
      </MarketplaceFunctionNote>
      <section data-marketplace-skill-origin>
        <MarketplaceCard>
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold">
              {translate(
                'auto.components.marketplace.MarketplaceSkillPage.origin',
                'Where it comes from'
              )}
            </h3>
          </div>
          <MarketplaceCardRow
            name="MassOrca"
            description={translate(
              'auto.components.marketplace.MarketplaceSkillBuiltInPage.originDetail',
              'Built into this version of MassOrca. It has no install to remove.'
            )}
          />
        </MarketplaceCard>
      </section>
      {settingsPane === null ? null : (
        <section data-marketplace-skill-settings>
          <MarketplaceCardLabel>
            {translate(
              'auto.components.marketplace.MarketplaceSkillBuiltInPage.settings',
              'Settings'
            )}
          </MarketplaceCardLabel>
          <MarketplaceCard>
            <MarketplaceCardRow
              name={translate(
                'auto.components.marketplace.MarketplaceSkillBuiltInPage.orchestrationSettings',
                'Orchestration settings'
              )}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openSettings(settingsPane)}
              >
                {translate('auto.components.marketplace.MarketplaceSkillBuiltInPage.open', 'Open')}
              </Button>
            </MarketplaceCardRow>
          </MarketplaceCard>
        </section>
      )}
      <MarketplaceFunctionNote part="banner">
        {translate(
          'auto.components.marketplace.MarketplaceSkillBuiltInPage.noBanner',
          '{{name}} has no example prompts.',
          { name }
        )}
      </MarketplaceFunctionNote>
      <MarketplaceAppSection
        id="connection"
        title={translate(
          'auto.components.marketplace.MarketplaceAppConnection.title',
          'Connection'
        )}
      >
        <MarketplaceFunctionNote part="connection">
          {translate(
            'auto.components.marketplace.MarketplaceSkillBuiltInPage.noConnection',
            'Built-in commands need no account.'
          )}
        </MarketplaceFunctionNote>
      </MarketplaceAppSection>
      <MarketplaceIntegrationAdvanced>
        <MarketplaceFunctionNote
          part="access"
          label={translate(
            'auto.components.marketplace.MarketplaceAppAccess.title',
            'Who can use it'
          )}
        >
          {translate(
            'auto.components.marketplace.MarketplaceSkillBuiltInPage.noAccess',
            'Built-in commands cannot be limited per agent yet.'
          )}
        </MarketplaceFunctionNote>
        <MarketplaceFunctionNote part="advanced">
          {settingsPane === null
            ? translate(
                'auto.components.marketplace.MarketplaceSkillBuiltInPage.noAdvanced',
                'It has no options of its own.'
              )
            : translate(
                'auto.components.marketplace.MarketplaceSkillBuiltInPage.settingsAbove',
                'Its settings are in Settings above.'
              )}
        </MarketplaceFunctionNote>
      </MarketplaceIntegrationAdvanced>
      <MarketplaceAppSection
        id="danger"
        title={translate('auto.components.marketplace.MarketplaceAppDanger.title', 'Danger zone')}
      >
        <MarketplaceFunctionNote part="uninstall">
          {translate(
            'auto.components.marketplace.MarketplaceSkillBuiltInPage.noUninstall',
            'Built into MassOrca, so there is nothing to remove.'
          )}
        </MarketplaceFunctionNote>
      </MarketplaceAppSection>
    </div>
  )
}
