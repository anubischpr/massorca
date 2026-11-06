import { Copy, Reply } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'

/** Copy and reply under a bot's reply: small and muted, below the bubble. */
export function BotTeamRoomMessageActions({
  copyText,
  botName,
  onReply
}: {
  /** The message text to copy; null hides Copy when the reply is files only. */
  copyText: string | null
  botName: string
  /** Puts `@botName` in the room's composer; null hides Reply. */
  onReply?: () => void
}): React.JSX.Element | null {
  if (copyText === null && !onReply) {
    return null
  }
  const copy = (): void => {
    if (copyText === null) {
      return
    }
    void navigator.clipboard.writeText(copyText).then(
      () => toast.success(translate('components.botTeams.messageCopied', 'Message copied')),
      () =>
        toast.error(
          translate('components.botTeams.messageCopyFailed', 'Could not copy the message')
        )
    )
  }
  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex items-center gap-0.5 text-muted-foreground">
        {copyText === null ? null : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={translate('components.botTeams.copyMessage', 'Copy message')}
                onClick={copy}
              >
                <Copy />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {translate('components.botTeams.copyMessage', 'Copy message')}
            </TooltipContent>
          </Tooltip>
        )}
        {onReply ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={translate('components.botTeams.replyTo', 'Reply to {{name}}', {
                  name: botName
                })}
                onClick={onReply}
              >
                <Reply />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {translate('components.botTeams.reply', 'Reply')}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  )
}
