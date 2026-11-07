import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'

/** The message a reply answers, quoted above the composer; its X drops the quote and keeps the draft. */
export function BotTeamRoomReplyBar({
  botName,
  quote,
  onCancel
}: {
  botName: string
  quote: string
  onCancel: () => void
}): React.JSX.Element {
  const cancel = translate('components.botTeams.cancelReply', 'Cancel reply')
  return (
    <div className="mb-1.5 flex items-start gap-2 rounded-xl border border-border bg-muted/50 py-1.5 pl-3 pr-1.5 text-xs">
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground">
          {translate('components.botTeams.replyingTo', 'Replying to {{name}}', { name: botName })}
        </p>
        <p className="line-clamp-2 break-words text-foreground/80">{quote}</p>
      </div>
      <TooltipProvider delayDuration={400}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={cancel} onClick={onCancel}>
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {cancel}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
