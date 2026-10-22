import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { NativeChatMarkdown } from './NativeChatMarkdown'
import {
  readNativeChatPlanDocument,
  type NativeChatPlanDocumentOutcome
} from './native-chat-plan-document-read-client'

/** Read-only view of an Antigravity plan document, fetched from the host that owns the chat. It
 *  reads again when the agent rewrites the file (`refreshKey`) and never opens a path itself. */
export function NativeChatPlanDocumentViewer(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: RuntimeClientTarget
  sessionId: string
  path: string
  fileName: string
  refreshKey: string
}): React.JSX.Element {
  const { t } = useTranslation()
  const { open, target, sessionId, path, refreshKey } = props
  const [outcome, setOutcome] = useState<NativeChatPlanDocumentOutcome | null>(null)
  useEffect(() => {
    if (!open) {
      return
    }
    let current = true
    void readNativeChatPlanDocument({ target, sessionId, path }).then((next) => {
      if (current) {
        setOutcome(next)
      }
    })
    return () => {
      current = false
    }
  }, [open, target, sessionId, path, refreshKey])
  const message =
    outcome?.kind === 'unsupported'
      ? t(
          'components.nativeChatSummary.planDocumentUnsupported',
          'This host does not support viewing plan documents.'
        )
      : outcome?.kind === 'refused'
        ? t(
            'components.nativeChatSummary.planDocumentRefused',
            'This plan document is no longer available.'
          )
        : outcome?.kind === 'unavailable'
          ? t(
              'components.nativeChatSummary.planDocumentUnavailable',
              'Could not load the plan document.'
            )
          : t('components.nativeChatSummary.planDocumentLoading', 'Loading…')
  return (
    <Dialog open={open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[80vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="break-words">{props.fileName}</DialogTitle>
          <DialogDescription className="break-all">{path}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto scrollbar-sleek">
          {outcome?.kind === 'ready' ? (
            <NativeChatMarkdown content={outcome.text} />
          ) : (
            <p className="text-muted-foreground">{message}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
