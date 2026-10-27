import { useTranslation } from 'react-i18next'
import { isMacPlatform } from '@/components/terminal-pane/terminal-link-open-hints'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { basename } from '@/lib/path'
import { NativeChatRecordedFileContent } from './NativeChatRecordedFileContent'
import {
  closeNativeChatRecordedFile,
  useNativeChatRecordedFileRequest
} from './native-chat-recorded-file-request'

/** Read-only view of a file the chat's agent saved outside a paired host's worktree. The host
 *  serves it only because its own record shows the agent wrote it; nothing here can edit it. */
export function NativeChatRecordedFileViewer(props: { sessionId: string }): React.JSX.Element {
  const { t } = useTranslation()
  const request = useNativeChatRecordedFileRequest(props.sessionId)
  const path = request?.path ?? null
  return (
    <Dialog open={path !== null} onOpenChange={(open) => !open && closeNativeChatRecordedFile()}>
      {/* Why: a bounded flex column, so a tall or wide body scrolls inside the dialog. */}
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader className="min-w-0">
          <DialogTitle className="break-words">{path ? basename(path) : ''}</DialogTitle>
          <DialogDescription className="break-all">
            {path}
            {' · '}
            {t(
              'components.native-chat.fileLinks.viewerReadOnly',
              'Read-only preview from the remote host'
            )}
          </DialogDescription>
          <p className="text-sm text-muted-foreground">
            {isMacPlatform()
              ? t(
                  'components.native-chat.fileLinks.recordedFileTabHintMac',
                  '⌘⌥+click opens it in a tab'
                )
              : t(
                  'components.native-chat.fileLinks.recordedFileTabHintOther',
                  'Ctrl+Alt+click opens it in a tab'
                )}
          </p>
        </DialogHeader>
        {request ? <NativeChatRecordedFileContent source={request} /> : null}
      </DialogContent>
    </Dialog>
  )
}
