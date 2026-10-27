import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStructuredAgentSessionHostLabel } from './use-structured-agent-session-host-label'
import {
  readAgentSessionConnectorSnapshot,
  type AgentSessionConnectorSnapshot
} from '../../../../shared/agent-session-connectors'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import type { AgentSessionBackgroundTaskState } from '../../../../shared/agent-session-wire'
import type { AgentChildWorkView } from '../../../../shared/agent-status-child-work-view'
import {
  buildAgentChildRowModels,
  type AgentChildRowContext,
  type AgentChildRowModel
} from '../../../../shared/agent-child-row-model'
import type { StructuredAgentContextSummary } from '../../../../shared/structured-agent-session-context-usage'
import type { StructuredAgentSubagentRoster } from '../../../../shared/structured-agent-session-subagent-roster'
import { createNativeChatFileHref } from '../../../../shared/native-chat-href-routing'
import type { CommentMarkdownLinkClickHandler } from '@/components/sidebar/CommentMarkdown'
import { AgentChildRowContent } from '@/components/AgentChildRowContent'
import { agentChildRowName } from '@/components/agent-child-row-text'
import { useNow } from '@/hooks/use-now'
import type { NativeChatFileLinkContext } from './native-chat-file-link'
import {
  NativeChatCodexBackgroundPanel,
  isRunningChildRow,
  UNVERIFIABLE
} from './NativeChatCodexBackgroundPanel'
import {
  NativeChatBackgroundTaskStopControl,
  type NativeChatBackgroundStop
} from './NativeChatBackgroundTaskStopControl'
import { NativeChatSessionConnectorRow } from './NativeChatSessionConnectorRow'
import { NativeChatSessionContextSection } from './NativeChatSessionContextSection'
import { NativeChatSessionEnvironment } from './NativeChatSessionEnvironment'
import { NativeChatSessionPlanSection } from './NativeChatSessionPlanSection'
import { NativeChatSessionSection } from './NativeChatSessionSection'
import { NativeChatSessionServers } from './NativeChatSessionServers'
import { NativeChatSessionVisualRow } from './NativeChatSessionVisualRow'
import { useNativeChatVisualOwner } from './native-chat-visual-owner'
import { useOpenNativeChatVisual } from './use-native-chat-visual-open'
import {
  nativeChatSessionConnectors,
  nativeChatSessionPlan,
  nativeChatSessionPlanDocument,
  nativeChatSessionResultFiles,
  nativeChatSessionVisuals
} from './native-chat-session-summary'

/** Every row in a tree, owned rows included, so running counts cover nested subagents too. */
function allChildRows(rows: readonly AgentChildRowModel[]): AgentChildRowModel[] {
  return rows.flatMap((row) => [row, ...allChildRows(row.owned)])
}

/** A running subagent's compact line: its name, then the model and effort only when recorded. */
function subagentLine(row: AgentChildRowModel): string {
  return [
    agentChildRowName(row),
    row.recordedConfiguration?.model,
    row.recordedConfiguration?.effort
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

/** The chat's summary rail: a stack of inline-expanding sections, each compact until opened. */
export function NativeChatSessionSummary(props: {
  target: RuntimeClientTarget
  /** The structured session whose host serves the plan document. */
  sessionId?: string
  fileContext: NativeChatFileLinkContext | null
  journalItems: readonly AgentJournalRenderItem[]
  connectorSnapshot?: AgentSessionConnectorSnapshot
  contextSummary: StructuredAgentContextSummary | null
  commandActivity?: AgentChildWorkView[]
  roster: AgentSessionBackgroundTaskState | null | undefined
  context?: AgentChildRowContext
  subagentRoster?: StructuredAgentSubagentRoster
  isVisible: boolean
  onLinkClick: CommentMarkdownLinkClickHandler | undefined
  /** In-flight stops and the stop action; absent where this card cannot stop tasks. */
  backgroundStop?: Omit<NativeChatBackgroundStop, 'supportsTaskStop'>
}): React.JSX.Element {
  const { t } = useTranslation()
  const hostLabel = useStructuredAgentSessionHostLabel(props.target)
  const worktreeId = props.fileContext?.worktreeId
  const workspaceRoot = props.fileContext?.worktreePath ?? null
  const results = useMemo(
    () => nativeChatSessionResultFiles(props.journalItems, workspaceRoot),
    [props.journalItems, workspaceRoot]
  )
  // Visuals list only under a structured chat's owner, where the transcript can mount them too.
  const owner = useNativeChatVisualOwner()
  const openVisual = useOpenNativeChatVisual(owner)
  const visuals = useMemo(
    () => (owner ? nativeChatSessionVisuals(props.journalItems) : []),
    [owner, props.journalItems]
  )
  const resultCount = visuals.length + results.length
  const connectors = useMemo(
    () => nativeChatSessionConnectors(props.journalItems),
    [props.journalItems]
  )
  const plan = useMemo(() => nativeChatSessionPlan(props.journalItems), [props.journalItems])
  const planDocument = useMemo(
    () => nativeChatSessionPlanDocument(props.journalItems, workspaceRoot),
    [props.journalItems, workspaceRoot]
  )
  const connectorSnapshot =
    props.context?.transportObservation === 'unverifiable'
      ? undefined
      : readAgentSessionConnectorSnapshot(props.connectorSnapshot)
  const currentConnectors = connectorSnapshot?.servers
  const views = props.commandActivity ?? props.roster?.children
  const childRows = useMemo(
    () => (views ? buildAgentChildRowModels(views, props.context ?? UNVERIFIABLE) : []),
    [views, props.context]
  )
  const rows = useMemo(() => allChildRows(childRows), [childRows])
  const now = useNow(1_000, props.isVisible && rows.some((row) => !row.settled))
  const runningAgents = rows.filter((row) => row.kind === 'agent' && isRunningChildRow(row))
  const runningBackground = rows.filter((row) => row.kind !== 'agent' && isRunningChildRow(row))
  const hasAgentRows = rows.some((row) => row.kind === 'agent')
  const viewAgentCount = views?.filter((entry) => entry.kind === 'agent').length ?? 0
  const legacyAgents = viewAgentCount === 0 ? [...(props.subagentRoster?.values() ?? [])] : []

  const unavailable = t('components.nativeChatSummary.unavailable', 'Unavailable')
  const count = (value: number) =>
    t('components.nativeChatSummary.reported', '{{count}} reported', { count: value })
  const running = (value: number) =>
    t('components.nativeChatSummary.runningCount', '{{count}} running', { count: value })
  const host =
    props.target.kind === 'local'
      ? t('components.nativeChatSummary.local', 'Local')
      : (hostLabel ?? unavailable)
  const subagentsUnknown = t(
    'components.nativeChatSummary.subagentsUnknown',
    'Subagent information is not reported by this provider or host.'
  )
  const backgroundUnknown = t(
    'components.nativeChatSummary.backgroundUnknown',
    'Background task information is not reported by this provider or host.'
  )
  const noResults = t(
    'components.nativeChatSummary.noResults',
    'No file changes or visuals reported.'
  )
  const connectorUnknown = t(
    'components.nativeChatSummary.connectorUnknown',
    'Current connector status is not reported by this provider or host.'
  )
  const connectorObserved = connectorSnapshot
    ? t('components.nativeChatSummary.connectorObserved', 'Provider status at {{time}}.', {
        time: new Date(connectorSnapshot.observedAt).toLocaleTimeString()
      })
    : null

  const resultsCompact =
    resultCount === 0 ? (
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
  const resultsExpanded = (
    <>
      <p className="text-muted-foreground">
        {t(
          'components.nativeChatSummary.loadedResults',
          'File changes and visuals recorded in the loaded chat history.'
        )}
      </p>
      {resultCount === 0 ? (
        <p>{noResults}</p>
      ) : (
        <>
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
    </>
  )

  const agentsSummary =
    legacyAgents.length > 0
      ? count(legacyAgents.length)
      : views
        ? running(runningAgents.length)
        : unavailable
  const agentsCompact =
    legacyAgents.length > 0 ? (
      legacyAgents.slice(0, 3).map(({ entry }) => (
        <p key={entry.id} className="truncate">
          {entry.label}
        </p>
      ))
    ) : !views ? (
      <p>{subagentsUnknown}</p>
    ) : runningAgents.length === 0 ? (
      <p>{t('components.nativeChatSummary.noRunningAgents', 'No running subagents')}</p>
    ) : (
      runningAgents.slice(0, 3).map((row) => (
        <p key={row.id} className="truncate">
          {subagentLine(row)}
        </p>
      ))
    )
  const agentsExpanded =
    legacyAgents.length > 0 ? (
      <div className="space-y-3">
        {legacyAgents.map(({ entry }) => (
          <div key={entry.id}>
            <p>{entry.label}</p>
            <p className="text-muted-foreground">
              {entry.state} · {unavailable}
            </p>
          </div>
        ))}
      </div>
    ) : !views ? (
      <p className="text-muted-foreground">{subagentsUnknown}</p>
    ) : !hasAgentRows ? (
      <p>{t('components.nativeChatSummary.noSubagents', 'No subagents reported.')}</p>
    ) : (
      <NativeChatCodexBackgroundPanel
        journalItems={props.journalItems}
        commandActivity={props.commandActivity}
        roster={props.roster}
        context={props.context}
        isVisible={props.isVisible}
        section="agents"
        embedded
      />
    )

  const connectorsCompact = (
    <>
      {currentConnectors ? (
        currentConnectors
          .slice(0, 3)
          .map((connector) => (
            <NativeChatSessionConnectorRow key={connector.name} connector={connector} />
          ))
      ) : (
        <p>{connectorUnknown}</p>
      )}
      {connectorObserved ? <p>{connectorObserved}</p> : null}
    </>
  )
  const connectorsExpanded = (
    <>
      <p className="text-muted-foreground">{connectorObserved ?? connectorUnknown}</p>
      {currentConnectors?.map((connector) => (
        <NativeChatSessionConnectorRow key={connector.name} connector={connector} expanded />
      ))}
      <p className="text-muted-foreground">
        {t('components.nativeChatSummary.connectorHistory', 'Recorded calls (historical)')}
      </p>
      {connectors.length === 0 ? (
        <p>{t('components.nativeChatSummary.noConnectors', 'No connector calls reported.')}</p>
      ) : (
        connectors.map((connector) => (
          <div key={connector.server} className="break-words">
            <p>
              {connector.server} · {connector.tool}
            </p>
            <p className="text-muted-foreground">{connector.state}</p>
            {connector.error ? (
              <pre className="mt-1 whitespace-pre-wrap">{connector.error}</pre>
            ) : null}
          </div>
        ))
      )}
    </>
  )

  const backgroundStopState: NativeChatBackgroundStop | undefined = props.backgroundStop
    ? { ...props.backgroundStop, supportsTaskStop: props.roster?.supportsTaskStop }
    : undefined
  const backgroundCompact = !views ? (
    <p>{backgroundUnknown}</p>
  ) : runningBackground.length === 0 ? (
    <p>{t('components.nativeChatSummary.noRunningBackground', 'No running background tasks')}</p>
  ) : (
    runningBackground.slice(0, 3).map((row) => (
      <div key={row.id} className="flex min-w-0 items-center gap-1">
        <div className="min-w-0 flex-1 truncate">
          <AgentChildRowContent
            row={row}
            now={now}
            leadClassName="text-foreground"
            trailClassName="text-muted-foreground"
            separator=" · "
            lineTitle
          />
        </div>
        {backgroundStopState ? (
          <NativeChatBackgroundTaskStopControl row={row} stop={backgroundStopState} />
        ) : null}
      </div>
    ))
  )
  const backgroundExpanded =
    views || props.roster ? (
      <NativeChatCodexBackgroundPanel
        journalItems={props.journalItems}
        commandActivity={props.commandActivity}
        roster={props.roster}
        context={props.context}
        isVisible={props.isVisible}
        section="commands"
        embedded
        stop={backgroundStopState}
      />
    ) : (
      <p className="text-muted-foreground">{backgroundUnknown}</p>
    )

  return (
    <aside
      aria-label={t('components.nativeChatSummary.title', 'Chat summary')}
      className="scrollbar-sleek mt-3 mr-3 max-h-full w-72 max-w-full shrink-0 self-start overflow-auto p-3 text-xs"
    >
      <h2 className="mb-2 font-medium">
        {t('components.nativeChatSummary.title', 'Chat summary')}
      </h2>
      <div className="space-y-2">
        <NativeChatSessionEnvironment fileContext={props.fileContext} host={host} />
        <NativeChatSessionPlanSection
          list={plan}
          document={planDocument}
          viewer={
            props.sessionId ? { target: props.target, sessionId: props.sessionId } : undefined
          }
        />
        <NativeChatSessionContextSection
          summary={props.contextSummary}
          sessionId={props.sessionId}
        />
        <NativeChatSessionSection
          title={t('components.nativeChatSummary.results', 'Results')}
          summary={count(resultCount)}
          compact={resultsCompact}
        >
          {resultsExpanded}
        </NativeChatSessionSection>
        <NativeChatSessionSection
          title={t('components.nativeChatSummary.agents', 'Subagents')}
          summary={agentsSummary}
          compact={agentsCompact}
        >
          {agentsExpanded}
        </NativeChatSessionSection>
        <NativeChatSessionSection
          title={t('components.nativeChatSummary.connectors', 'Connectors')}
          summary={currentConnectors ? count(currentConnectors.length) : unavailable}
          compact={connectorsCompact}
        >
          {connectorsExpanded}
        </NativeChatSessionSection>
        <NativeChatSessionSection
          title={t('components.nativeChatSummary.commands', 'Background tasks')}
          summary={views ? running(runningBackground.length) : unavailable}
          compact={backgroundCompact}
        >
          {backgroundExpanded}
        </NativeChatSessionSection>
        <NativeChatSessionServers target={props.target} worktreeId={worktreeId ?? null} />
      </div>
    </aside>
  )
}
