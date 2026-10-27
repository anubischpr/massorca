import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { basename } from '@/lib/path'
import { useAppStore } from '@/store'
import { readRuntimeFilePreview } from '@/runtime/runtime-file-client'
import {
  isOutsideRemoteWorkspaceError,
  RecordedFileHostOutdatedError,
  RecordedFileRefusedError
} from '@/runtime/runtime-recorded-file-client'
import type { RuntimeFilePreviewResult } from '../../../../shared/runtime-file-contracts'
import { NativeChatMarkdown } from './NativeChatMarkdown'
import { NativeChatVisualFrame } from './NativeChatVisualFrame'
import {
  closeNativeChatRecordedFile,
  useNativeChatRecordedFileRequest
} from './native-chat-recorded-file-request'

type Outcome =
  | { kind: 'ready'; preview: RuntimeFilePreviewResult }
  | { kind: 'failed'; reason: 'outdated' | 'outside' | 'missing' | 'tooLarge' | 'unavailable' }

function failureReason(error: unknown): Extract<Outcome, { kind: 'failed' }>['reason'] {
  if (error instanceof RecordedFileHostOutdatedError) {
    return 'outdated'
  }
  if (isOutsideRemoteWorkspaceError(error)) {
    return 'outside'
  }
  if (error instanceof RecordedFileRefusedError) {
    if (error.reason === 'not_found') {
      return 'missing'
    }
    if (error.reason === 'too_large') {
      return 'tooLarge'
    }
  }
  return 'unavailable'
}

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
      <div ref={frameScopeRef} className="flex h-[60vh] min-h-0">
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
    return <NativeChatMarkdown content={preview.content} />
  }
  return (
    <pre className="font-mono text-[13px] break-words whitespace-pre-wrap">{preview.content}</pre>
  )
}

/** Read-only view of a file the chat's agent saved outside a paired host's worktree. The host
 *  serves it only because its own record shows the agent wrote it; nothing here can edit it. */
export function NativeChatRecordedFileViewer(props: { sessionId: string }): React.JSX.Element {
  const { t } = useTranslation()
  const request = useNativeChatRecordedFileRequest(props.sessionId)
  const [loaded, setLoaded] = useState<{ path: string; outcome: Outcome } | null>(null)
  const path = request?.path ?? null
  useEffect(() => {
    if (!request) {
      return
    }
    let current = true
    const { sessionId, worktreeId, worktreePath } = request
    const settle = (outcome: Outcome): void => {
      if (current) {
        setLoaded({ path: request.path, outcome })
      }
    }
    void readRuntimeFilePreview(
      {
        settings: useAppStore.getState().settings,
        worktreeId,
        worktreePath,
        agentSessionId: sessionId
      },
      request.path
    ).then(
      (preview) => settle({ kind: 'ready', preview }),
      (error: unknown) => settle({ kind: 'failed', reason: failureReason(error) })
    )
    return () => {
      current = false
    }
  }, [request])

  const outcome = loaded && loaded.path === path ? loaded.outcome : null
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
    <Dialog open={path !== null} onOpenChange={(open) => !open && closeNativeChatRecordedFile()}>
      <DialogContent className="max-h-[85vh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="break-words">{path ? basename(path) : ''}</DialogTitle>
          <DialogDescription className="break-all">
            {path}
            {' · '}
            {t(
              'components.native-chat.fileLinks.viewerReadOnly',
              'Read-only preview from the remote host'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto scrollbar-sleek">
          {outcome?.kind === 'ready' && path ? (
            <ViewerBody path={path} preview={outcome.preview} />
          ) : (
            <p className="text-muted-foreground">{message}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
