import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

/** The bar over a team's sections: back, the title, the team, and what sits at the far end. */
export function BotTeamViewHeader({
  title,
  detail,
  onBack,
  backLabel,
  trailing
}: {
  title: string
  detail: string
  onBack: () => void
  /** Where back goes; the Conference room unless a section sits under another. */
  backLabel?: string
  trailing?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4 text-sm font-medium">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ChevronLeft className="size-3.5" />
        {backLabel ?? translate('components.botTeams.conferenceRoom', 'Conference room')}
      </Button>
      <span className={trailing ? 'truncate' : 'min-w-0 flex-1 truncate'}>{title}</span>
      <span className="truncate text-xs text-muted-foreground">{detail}</span>
      {trailing ? <span className="min-w-0 flex-1" /> : null}
      {trailing}
    </div>
  )
}
