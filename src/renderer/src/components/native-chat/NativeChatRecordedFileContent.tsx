import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { basename } from '@/lib/path'
import type { RuntimeFilePreviewResult } from '../../../../shared/runtime-file-contracts'
import { NativeChatMarkdown } from './NativeChatMarkdown'
import { NativeChatVisualFrame } from './NativeChatVisualFrame'
import { type RecordedFileSource, useRecordedFilePreview } from './use-recorded-file-preview'

function ViewerBody(props: { path: string; preview: RuntimeFilePreviewResult }): React.JSX.Element {
  const { t } = useTranslation()
  const { path, preview } = props
  const frameScopeRef = useRef<HTMLDivElement | null>(null)
  const [retired, setRetired] = useState(false)
  const extension = /\.[^./\\]+$/.exec(path)?.[0].toLowerCase() ?? ''
  if (preview.isBinary) {
    return preview.isImage && preview.mimeType?.startsWith('image/') ? (
      <img
        src={`data:${preview.mimeType};base64,${preview.content}`}
        alt={basename(path)}
        className="mx-auto max-h-[60vh] max-w-full object-contain"
      />
    ) : (
      <p className="text-muted-foreground">
        {t(
          'components.native-chat.fileLinks.viewerUnsupportedType',
          "This file type can't be previewed here."
        )}
      </p>
    )
  }
  if (extension === '.html' || extension === '.htm') {
    return retired ? (
      <p className="text-muted-foreground">
        {t('components.native-chat.fileLinks.viewerUnavailable', 'Could not load this file.')}
      </p>
    ) : (
      // Why: at least 60vh so the frame keeps its size, and the body scrolls when the pane is shorter.
      <div ref={frameScopeRef} className="flex min-h-[60vh] min-w-0 flex-1">
        <NativeChatVisualFrame
          document={{ revision: path, html: preview.content }}
          title={basename(path)}
          layout="panel"
          themeScope={frameScopeRef}
          onRetired={() => setRetired(true)}
        />
      </div>
    )
  }
  if (extension === '.md' || extension === '.markdown') {
    // Why: a wide code block or table scrolls inside its own box rather than past the dialog edge.
    return (
      <div className="min-w-0 overflow-x-auto">
        <NativeChatMarkdown content={preview.content} />
      </div>
    )
  }
  return (
    <pre className="min-w-0 font-mono text-xs break-words whitespace-pre-wrap text-foreground">
      {preview.content}
    </pre>
  )
}

/** Read-only body of a recorded file. The caller bounds its height; this region scrolls inside it. */
export function NativeChatRecordedFileContent(props: {
  source: RecordedFileSource
}): React.JSX.Element {
  const { t } = useTranslation()
  const { source } = props
  const outcome = useRecordedFilePreview(source)
  const message =
    outcome?.kind === 'failed'
      ? {
          outdated: t(
            'components.native-chat.fileLinks.remoteHostOutdated',
            'Update Orca on the remote host to open files the agent saved outside the workspace.'
          ),
          outside: t(
            'components.native-chat.fileLinks.outsideRemoteWorkspace',
            "This file is outside the workspace on the remote host, so Orca can't open it."
          ),
          missing: t(
            'components.native-chat.fileLinks.viewerNotFound',
            'This file no longer exists on the remote host.'
          ),
          tooLarge: t(
            'components.native-chat.fileLinks.viewerTooLarge',
            'This file is too large to preview.'
          ),
          unavailable: t(
            'components.native-chat.fileLinks.viewerUnavailable',
            'Could not load this file.'
          )
        }[outcome.reason]
      : t('components.native-chat.fileLinks.viewerLoading', 'Loading…')
  return (
    <div
      data-testid="recorded-file-body"
      className="flex min-h-0 flex-1 flex-col overflow-auto scrollbar-sleek"
    >
      {outcome?.kind === 'ready' ? (
        <ViewerBody path={source.path} preview={outcome.preview} />
      ) : (
        <p className="text-muted-foreground">{message}</p>
      )}
    </div>
  )
}
