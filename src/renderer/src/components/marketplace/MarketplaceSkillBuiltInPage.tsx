import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import {
  MarketplaceBreadcrumb,
  MarketplaceCard,
  MarketplaceCardLabel,
  MarketplaceCardRow,
  MarketplaceItemHeader
} from './MarketplaceDetail'
import type { BuiltInSkillCommand } from './marketplace-skill-built-in'
import { skillDisplayName } from './marketplace-skill-display-name'

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

  const openSettings = (pane: 'orchestration'): void => {
    openSettingsTarget({ pane, repoId: null })
    openSettingsPage()
  }

  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex max-w-4xl flex-col gap-6 py-4')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MarketplaceBreadcrumb name={name} onBack={onBack} />
      </div>
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
    </div>
  )
}
