import { forwardRef } from 'react'
import { Gitlab, GitPullRequestArrow, type LucideIcon, type LucideProps } from 'lucide-react'
import { JiraIcon } from '@/components/icons/JiraIcon'
import { LinearIcon } from '@/components/icons/LinearIcon'
import { cn } from '@/lib/utils'
import type { MarketplaceIntegrationId } from './marketplace-integrations'

// Why: the brand logos are plain components, so they are wrapped to fit the LucideIcon slot catalog rows take.
const LinearGlyph = forwardRef<SVGSVGElement, LucideProps>(function LinearGlyph(props, _ref) {
  return <LinearIcon className={props.className} />
})
const JiraGlyph = forwardRef<SVGSVGElement, LucideProps>(function JiraGlyph(props, _ref) {
  return <JiraIcon className={props.className} />
})

// Why: the same icons the Settings Integrations cards use.
const INTEGRATION_GLYPHS: Record<MarketplaceIntegrationId, LucideIcon> = {
  gitlab: Gitlab,
  bitbucket: GitPullRequestArrow,
  'azure-devops': GitPullRequestArrow,
  gitea: GitPullRequestArrow,
  linear: LinearGlyph,
  jira: JiraGlyph
}

export function integrationGlyph(id: MarketplaceIntegrationId): LucideIcon {
  return INTEGRATION_GLYPHS[id]
}

export function MarketplaceIntegrationIcon({
  id,
  className
}: {
  id: MarketplaceIntegrationId
  className?: string
}): React.JSX.Element {
  const Icon = INTEGRATION_GLYPHS[id]
  return <Icon className={cn('size-4 shrink-0 text-muted-foreground', className)} aria-hidden />
}
