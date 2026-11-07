import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import { createNativeChatFileHref } from '../../../../shared/native-chat-href-routing'
import { environmentUrlsFromJournalItems } from '../../../../shared/native-chat-environment-urls'
import { isBoundDesignFile } from '../../../../shared/prototype-design-folders'
import type { CommentMarkdownLinkClickHandler } from '@/components/sidebar/CommentMarkdown'
import { NativeChatSessionEnvironmentUrlRow } from './NativeChatSessionEnvironmentUrlRow'
import { NativeChatSessionSection } from './NativeChatSessionSection'
import { NativeChatSessionVisualRow } from './NativeChatSessionVisualRow'
import { clientRouteForEnvironmentUrl, useNativeChatPortRoute } from './use-native-chat-port-route'
import { useNativeChatVisualOwner } from './native-chat-visual-owner'
import { useOpenNativeChatVisual } from './use-native-chat-visual-open'
import { useBoundDesignFolders } from '../prototypes/prototype-bound-design-folders'
import {
  nativeChatSessionResultFiles,
  nativeChatSessionVisuals
} from './native-chat-session-summary'

/** The summary's Results: environment URLs first, then visuals and changed files. */
export function NativeChatSessionResultsSection(props: {
  target: RuntimeClientTarget
  sessionId?: string
  journalItems: readonly AgentJournalRenderItem[]
  workspaceRoot: string | null
  onLinkClick: CommentMarkdownLinkClickHandler | undefined
}): React.JSX.Element {
  const { t } = useTranslation()
  const results = useMemo(
    () => nativeChatSessionResultFiles(props.journalItems, props.workspaceRoot),
    [props.journalItems, props.workspaceRoot]
  )
  // Visuals list only under a structured chat's owner, where the transcript can mount them too.
  const owner = useNativeChatVisualOwner()
  const openVisual = useOpenNativeChatVisual(owner)
  // Why: a Gentle Shell design folder bound to a prototype request is the Prototypes view's, not an artifact.
  const boundDesignFolders = useBoundDesignFolders(props.sessionId)
  const visuals = useMemo(
    () =>
      owner
        ? nativeChatSessionVisuals(props.journalItems).filter(
            (visual) => !isBoundDesignFile(visual.file, boundDesignFolders)
          )
        : [],
    [owner, props.journalItems, boundDesignFolders]
  )
  const environmentUrls = useMemo(
    () => environmentUrlsFromJournalItems(props.journalItems),
    [props.journalItems]
  )
  const portRoute = useNativeChatPortRoute(props.target)
  const resultCount = environmentUrls.length + visuals.length + results.length

  const noResults = t(
    'components.nativeChatSummary.noResults',
    'No file changes, visuals or environment URLs reported.'
  )
  const compact =
    resultCount === 0 ? (
      <p>{noResults}</p>
    ) : (
      [
        ...environmentUrls.map((entry) => (
          <NativeChatSessionEnvironmentUrlRow key={`url:${entry.url}`} entry={entry} route={null} />
        )),
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

  return (
    <NativeChatSessionSection
      title={t('components.nativeChatSummary.results', 'Results')}
      summary={t('components.nativeChatSummary.reported', '{{count}} reported', {
        count: resultCount
      })}
      compact={compact}
    >
      <p className="text-muted-foreground">
        {t(
          'components.nativeChatSummary.loadedResults',
          'Environment URLs, file changes and visuals recorded in the loaded chat history.'
        )}
      </p>
      {resultCount === 0 ? (
        <p>{noResults}</p>
      ) : (
        <>
          {environmentUrls.map((entry) => (
            <NativeChatSessionEnvironmentUrlRow
              key={`url:${entry.url}`}
              entry={entry}
              route={clientRouteForEnvironmentUrl(entry.url, entry.loopback, portRoute)}
              expanded
            />
          ))}
          {visuals.map((visual) => (
            <NativeChatSessionVisualRow
              key={`visual:${visual.file}`}
              visual={visual}
              expanded
              onOpen={openVisual}
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
