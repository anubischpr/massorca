import { Brain, GitBranch, Github, Network, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketplaceItemId } from './marketplace-catalog'

const ITEM_ICONS: Record<MarketplaceItemId, LucideIcon> = {
  git: GitBranch,
  github: Github,
  engram: Brain,
  openmetadata: Network
}

export function MarketplaceItemIcon({
  id,
  className
}: {
  id: MarketplaceItemId
  className?: string
}): React.JSX.Element {
  const Icon = ITEM_ICONS[id]
  return <Icon className={cn('size-4 shrink-0 text-muted-foreground', className)} aria-hidden />
}
