import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { notifyInstalledAgentSkillsChanged } from '@/hooks/useInstalledAgentSkills'
import { translate } from '@/i18n/i18n'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import type { DiscoveredSkill } from '../../../../shared/skills'
import { SkillDeleteResultBand } from '../skills/SkillDeleteResultBand'
import { useSkillDeleteFlow } from '../skills/use-skill-delete-flow'
import { MarketplaceAppSection } from './MarketplaceAppSection'

/** Remove: the page's one irreversible action, which deletes every copy of the skill on the host the page reads. */
export function MarketplaceSkillDanger({
  copies,
  hostName,
  target,
  unavailableReason,
  onGone
}: {
  copies: readonly DiscoveredSkill[]
  hostName: string
  target: RuntimeClientTarget | null
  unavailableReason: string | null
  /** Called once every copy is gone, so the page returns to the list. */
  onGone: () => void
}): React.JSX.Element {
  const flow = useSkillDeleteFlow(target, hostName, (outcome) => {
    // Why: the list and this page both read the skills again, so a copy that stayed shows as it is.
    notifyInstalledAgentSkillsChanged()
    if (outcome.skills.every((skill) => skill.status === 'deleted')) {
      onGone()
    }
  })
  const removable = unavailableReason === null && flow.supported && !flow.running
  return (
    <MarketplaceAppSection
      id="danger"
      title={translate('auto.components.marketplace.MarketplaceSkillDanger.title', 'Danger zone')}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            {translate(
              'auto.components.marketplace.MarketplaceSkillDanger.removeTitle',
              'Remove this skill'
            )}
          </CardTitle>
          <CardDescription>
            {unavailableReason ??
              flow.unsupportedReason ??
              translate(
                'auto.components.marketplace.MarketplaceSkillDanger.description',
                'Deletes every copy of this skill on {{host}}. This cannot be undone.',
                { host: hostName }
              )}
          </CardDescription>
        </CardHeader>
        {unavailableReason === null ? (
          <CardContent>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!removable}
              onClick={() => void flow.requestDelete(copies)}
            >
              {translate(
                'auto.components.marketplace.MarketplaceSkillDanger.remove',
                'Remove from {{host}}',
                { host: hostName }
              )}
            </Button>
          </CardContent>
        ) : null}
      </Card>
      {flow.result === null ? null : (
        <SkillDeleteResultBand result={flow.result} onDismiss={flow.dismissResult} />
      )}
    </MarketplaceAppSection>
  )
}
