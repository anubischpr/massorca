import { useTranslation } from 'react-i18next'
import { createNativeChatFileHref } from '../../../../shared/native-chat-href-routing'
import type { CommentMarkdownLinkClickHandler } from '@/components/sidebar/CommentMarkdown'
import type {
  NativeChatSessionVisual,
  nativeChatSessionResultFiles
} from './native-chat-session-summary'
import { NativeChatSessionSection } from './NativeChatSessionSection'
import { NativeChatSessionVisualRow } from './NativeChatSessionVisualRow'

/** The summary rail's Results: the chat's visuals beside the file changes it recorded. */
export function NativeChatSessionResultsSection(props: {
  visuals: readonly NativeChatSessionVisual[]
  results: ReturnType<typeof nativeChatSessionResultFiles>
  summary: string
  onOpenVisual: (visual: NativeChatSessionVisual) => void
  onLinkClick: CommentMarkdownLinkClickHandler | undefined
}): React.JSX.Element {
  const { t } = useTranslation()
  const { visuals, results } = props
  const isEmpty = visuals.length + results.length === 0
  const noResults = t(
    'components.nativeChatSummary.noResults',
    'No file changes or visuals reported.'
  )
  return (
    <NativeChatSessionSection
      title={t('components.nativeChatSummary.results', 'Results')}
      summary={props.summary}
      compact={
        isEmpty ? (
          <p>{noResults}</p>
        ) : (
          [
            ...visuals.map((visual) => (
              <NativeChatSessionVisualRow key={`visual:${visual.file}`} visual={visual} />
            )),
            ...results.map((file) => (
              <p key={file.absolutePath} className="truncate" title={file.absolutePath}>
                {file.displayPath}
              </p>
            ))
          ].slice(0, 3)
        )
      }
    >
      <p className="text-muted-foreground">
        {t(
          'components.nativeChatSummary.loadedResults',
          'File changes and visuals recorded in the loaded chat history.'
        )}
      </p>
      {isEmpty ? (
        <p>{noResults}</p>
      ) : (
        <>
          {visuals.map((visual) => (
            <NativeChatSessionVisualRow
              key={`visual:${visual.file}`}
              visual={visual}
              expanded
              onOpen={props.onOpenVisual}
            />
          ))}
          {results.map((file) => (
            <a
              key={file.absolutePath}
              className="block break-words underline"
              title={file.absolutePath}
              href={createNativeChatFileHref(file.absolutePath, 'literal')}
              onClick={(event) =>
                props.onLinkClick?.(event, createNativeChatFileHref(file.absolutePath, 'literal'))
              }
            >
              {file.displayPath}
            </a>
          ))}
        </>
      )}
    </NativeChatSessionSection>
  )
}
