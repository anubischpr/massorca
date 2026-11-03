import { useEffect, useRef, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { basename } from '@/lib/path'
import type { RuntimeFilePreviewResult } from '../../../../shared/runtime-file-contracts'
import { NativeChatVisualFrame } from '../native-chat/NativeChatVisualFrame'
import { isHtmlPath } from './bot-team-file-kind'
import { readBotTeamFilePreview } from './bot-team-file-preview-read'

type Loaded =
  | { status: 'loading' }
  | { status: 'ready'; preview: RuntimeFilePreviewResult }
  | { status: 'failed' }

function Notice({ children }: { children: string }): React.JSX.Element {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

/**
 * A team file as it reads: an image, a PDF or a page rendered from HTML, the text otherwise.
 * The caller keys it by path, so a new file starts from loading.
 */
export function BotTeamFilePreview({
  teamId,
  relativePath,
  kind,
  text
}: {
  teamId: string
  relativePath: string
  /** The entry's kind in the team's listing: a binary file is read as a preview, not as text. */
  kind: 'text' | 'binary'
  /** A text file's content once read; null while it loads. */
  text: string | null
}): React.JSX.Element | null {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })
  const [retired, setRetired] = useState(false)
  const frameScope = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (kind !== 'binary') {
      return
    }
    let closed = false
    void readBotTeamFilePreview(teamId, relativePath).then(
      (preview) => {
        if (!closed) {
          setLoaded({ status: 'ready', preview })
        }
      },
      () => {
        if (!closed) {
          setLoaded({ status: 'failed' })
        }
      }
    )
    return () => {
      closed = true
    }
  }, [teamId, relativePath, kind])

  const unavailable = translate(
    'components.native-chat.fileLinks.viewerUnavailable',
    'Could not load this file.'
  )
  if (kind === 'binary') {
    if (loaded.status === 'loading') {
      return (
        <Notice>{translate('components.native-chat.fileLinks.viewerLoading', 'Loading…')}</Notice>
      )
    }
    if (loaded.status === 'failed') {
      return <Notice>{unavailable}</Notice>
    }
    const { preview } = loaded
    const mime = preview.mimeType ?? ''
    if (preview.isImage && mime.startsWith('image/')) {
      return (
        <img
          src={`data:${mime};base64,${preview.content}`}
          alt={basename(relativePath)}
          className="mx-auto max-h-[60vh] max-w-full object-contain"
        />
      )
    }
    if (preview.isImage && mime === 'application/pdf') {
      return (
        <iframe
          title={basename(relativePath)}
          src={`data:application/pdf;base64,${preview.content}`}
          className="h-[70vh] min-h-[420px] w-full rounded-xl border border-border bg-card"
        />
      )
    }
    return (
      <Notice>
        {translate(
          'components.native-chat.fileLinks.viewerUnsupportedType',
          "This file type can't be previewed here."
        )}
      </Notice>
    )
  }
  if (text === null) {
    return null
  }
  if (isHtmlPath(relativePath)) {
    return retired ? (
      <Notice>{unavailable}</Notice>
    ) : (
      <div ref={frameScope} className="flex min-h-[420px] min-w-0 flex-1">
        <NativeChatVisualFrame
          document={{ revision: relativePath, html: text }}
          title={basename(relativePath)}
          layout="panel"
          themeScope={frameScope}
          onRetired={() => setRetired(true)}
        />
      </div>
    )
  }
  return (
    <pre className="min-h-[420px] whitespace-pre-wrap break-words rounded-xl border border-border bg-card p-4 font-mono text-xs">
      {text}
    </pre>
  )
}
