import { useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { readBotTeamFile } from '@/runtime/runtime-bot-team-client'
import { isHtmlPath, isImagePath, isPdfPath } from './bot-team-file-kind'
import { readBotTeamFilePreview } from './bot-team-file-preview-read'

const EXCERPT_LINES = 8
// Why: no scripts and no network, so the bot's page shows its layout and nothing more.
const PAGE_THUMBNAIL_HEAD = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:">`
/** The page renders three times the card's size, then shrinks to fit it. */
const PAGE_THUMBNAIL_SCALE = 3

type Peek =
  | { status: 'loading' }
  | { status: 'image'; src: string }
  | { status: 'page'; srcDoc: string }
  | { status: 'text'; excerpt: string }
  | { status: 'none' }

/** The hover card of an attached file: a picture, a small render of a page, or its first lines, read when the card opens. */
export function BotTeamFileHoverPreview({
  teamId,
  path,
  name
}: {
  teamId: string
  path: string
  name: string
}): React.JSX.Element {
  const [peek, setPeek] = useState<Peek>({ status: 'loading' })
  useEffect(() => {
    let closed = false
    const settle = (next: Peek): void => {
      if (!closed) {
        setPeek(next)
      }
    }
    if (isPdfPath(path)) {
      settle({ status: 'none' })
    } else if (isImagePath(path)) {
      void readBotTeamFilePreview(teamId, path).then(
        (preview) =>
          settle(
            preview.isImage && preview.mimeType?.startsWith('image/')
              ? { status: 'image', src: `data:${preview.mimeType};base64,${preview.content}` }
              : { status: 'none' }
          ),
        () => settle({ status: 'none' })
      )
    } else {
      // A binary file is refused by the text read, which leaves the card on its open hint.
      void readBotTeamFile(teamId, path).then(
        (read) =>
          settle(
            read === 'unavailable'
              ? { status: 'none' }
              : isHtmlPath(path)
                ? { status: 'page', srcDoc: `${PAGE_THUMBNAIL_HEAD}${read.content}` }
                : {
                    status: 'text',
                    excerpt: read.content.split('\n').slice(0, EXCERPT_LINES).join('\n')
                  }
          ),
        () => settle({ status: 'none' })
      )
    }
    return () => {
      closed = true
    }
  }, [teamId, path])

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <span className="truncate font-medium">{name}</span>
      {peek.status === 'loading' ? (
        <span className="text-muted-foreground">
          {translate('components.native-chat.fileLinks.viewerLoading', 'Loading…')}
        </span>
      ) : null}
      {peek.status === 'image' ? (
        <img src={peek.src} alt={name} className="max-h-40 w-full rounded-md object-contain" />
      ) : null}
      {peek.status === 'page' ? (
        <div className="h-40 w-full overflow-hidden rounded-md border border-border bg-background">
          <iframe
            title={name}
            // SECURITY: never add allow-scripts or allow-same-origin; a bot's page is untrusted.
            sandbox=""
            referrerPolicy="no-referrer"
            tabIndex={-1}
            // Why: the frame scrolls the page under the wheel; the card keeps itself open meanwhile.
            srcDoc={peek.srcDoc}
            className="block border-0"
            style={{
              width: `${PAGE_THUMBNAIL_SCALE * 100}%`,
              height: `${PAGE_THUMBNAIL_SCALE * 100}%`,
              transform: `scale(${1 / PAGE_THUMBNAIL_SCALE})`,
              transformOrigin: '0 0'
            }}
          />
        </div>
      ) : null}
      {peek.status === 'text' ? (
        <pre className="max-h-40 overflow-hidden font-mono text-[11px] break-words whitespace-pre-wrap text-muted-foreground">
          {peek.excerpt}
        </pre>
      ) : null}
      {peek.status === 'none' ? (
        <span className="text-muted-foreground">
          {translate('components.botTeams.openToPreview', 'Open the file to see it.')}
        </span>
      ) : null}
    </div>
  )
}
