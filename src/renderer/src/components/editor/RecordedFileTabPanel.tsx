import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NativeChatRecordedFileContent } from '@/components/native-chat/NativeChatRecordedFileContent'
import { basename } from '@/lib/path'
import type { OpenFile } from '@/store/slices/editor'

/** A file the chat's agent saved outside a paired host's worktree, read-only in its own tab. */
export function RecordedFileTabPanel({ file }: { file: OpenFile }): React.JSX.Element | null {
  const { t } = useTranslation()
  const recordedFile = file.recordedFile
  const source = useMemo(
    () => (recordedFile ? { ...recordedFile, worktreeId: file.worktreeId } : null),
    [file.worktreeId, recordedFile]
  )
  if (!recordedFile || !source) {
    return null
  }
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-2">
        <p className="truncate text-sm font-medium text-foreground">
          {basename(recordedFile.path)}
        </p>
        <p className="break-all text-xs text-muted-foreground">
          {recordedFile.path}
          {' · '}
          {t(
            'components.native-chat.fileLinks.viewerReadOnly',
            'Read-only preview from the remote host'
          )}
        </p>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-3">
        <NativeChatRecordedFileContent source={source} />
      </div>
    </div>
  )
}
