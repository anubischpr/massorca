import { formatContextPercentage } from './native-chat-context-usage-summary'
import { NativeChatSessionConnectorRow } from './NativeChatSessionConnectorRow'
import { useStructuredAgentSessionHostLabel } from './use-structured-agent-session-host-label'
import {
  readAgentSessionConnectorSnapshot,
  type AgentSessionConnectorSnapshot
} from '../../../../shared/agent-session-connectors'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import type { AgentSessionBackgroundTaskState } from '../../../../shared/agent-session-wire'
import type { AgentChildWorkView } from '../../../../shared/agent-status-child-work-view'
import type { AgentChildRowContext } from '../../../../shared/agent-child-row-model'
import type { StructuredAgentContextUsage } from '../../../../shared/structured-agent-session-context-usage'
import { createNativeChatFileHref } from '../../../../shared/native-chat-href-routing'
import type { CommentMarkdownLinkClickHandler } from '@/components/sidebar/CommentMarkdown'
import type { NativeChatFileLinkContext } from './native-chat-file-link'
import { NativeChatCodexBackgroundPanel } from './NativeChatCodexBackgroundPanel'
import { NativeChatSessionServers } from './NativeChatSessionServers'
import {
  nativeChatSessionConnectors,
  nativeChatSessionResults
} from './native-chat-session-summary'
import type { StructuredAgentSubagentRoster } from '../../../../shared/structured-agent-session-subagent-roster'
import { buildAgentChildRowModels } from '../../../../shared/agent-child-row-model'

type SummarySection =
  | 'environment'
  | 'context'
  | 'results'
  | 'agents'
  | 'connectors'
  | 'commands'
  | 'servers'

export function NativeChatSessionSummary(props: {
  target: RuntimeClientTarget
  fileContext: NativeChatFileLinkContext | null
  journalItems: readonly AgentJournalRenderItem[]
  connectorSnapshot?: AgentSessionConnectorSnapshot
  contextUsage: StructuredAgentContextUsage | null
  commandActivity?: AgentChildWorkView[]
  roster: AgentSessionBackgroundTaskState | null | undefined
  context?: AgentChildRowContext
  subagentRoster?: StructuredAgentSubagentRoster
  isVisible: boolean
  onLinkClick: CommentMarkdownLinkClickHandler | undefined
}): React.JSX.Element {
  const { t } = useTranslation()
  const hostLabel = useStructuredAgentSessionHostLabel(props.target)
  const [section, setSection] = useState<SummarySection | null>(null)
  const worktreeId = props.fileContext?.worktreeId
  const branch = useAppStore(
    (state) =>
      Object.values(state.worktreesByRepo)
        .flat()
        .find((entry) => entry.id === worktreeId)?.branch
  )
  const results = useMemo(() => nativeChatSessionResults(props.journalItems), [props.journalItems])
  const connectors = useMemo(
    () => nativeChatSessionConnectors(props.journalItems),
    [props.journalItems]
  )
  const connectorSnapshot =
    props.context?.transportObservation === 'unverifiable'
      ? undefined
      : readAgentSessionConnectorSnapshot(props.connectorSnapshot)
  const currentConnectors = connectorSnapshot?.servers
  const views = props.commandActivity ?? props.roster?.children
  const agents = views?.filter((entry) => entry.kind === 'agent') ?? []
  const legacyAgents = agents.length === 0 ? [...(props.subagentRoster?.values() ?? [])] : []
  const commands = views?.filter((entry) => entry.kind !== 'agent' && entry.ownership === 'main')
  const commandRows = props.context ? buildAgentChildRowModels(views ?? [], props.context) : []
  const unavailable = t('components.nativeChatSummary.unavailable', 'Unavailable')
  const labels = {
    environment: t('components.nativeChatSummary.environment', 'Environment'),
    context: t('components.nativeChatSummary.context', 'Context'),
    results: t('components.nativeChatSummary.results', 'Results'),
    agents: t('components.nativeChatSummary.agents', 'Subagents'),
    connectors: t('components.nativeChatSummary.connectors', 'Connectors'),
    commands: t('components.nativeChatSummary.commands', 'Background tasks'),
    servers: t('components.nativeChatSummary.servers', 'QA servers')
  }
  const host =
    props.target.kind === 'local'
      ? t('components.nativeChatSummary.local', 'Local')
      : (hostLabel ?? unavailable)
  const count = (value: number) =>
    t('components.nativeChatSummary.reported', '{{count}} reported', { count: value })
  const summary = {
    environment: host,
    context: props.contextUsage
      ? `${props.contextUsage.estimated ? '~' : ''}${formatContextPercentage(props.contextUsage.percentage)}%`
      : unavailable,
    results: count(results.length),
    agents: count(agents.length + legacyAgents.length),
    connectors: currentConnectors ? count(currentConnectors.length) : unavailable,
    commands: commands ? count(commands.length) : unavailable
  }
  return (
    <aside
      aria-label={t('components.nativeChatSummary.title', 'Chat summary')}
      className={
        section
          ? 'scrollbar-sleek h-full min-h-0 w-80 shrink-0 overflow-auto border-l border-border bg-background p-3 text-xs'
          : 'scrollbar-sleek mt-3 mr-3 max-h-full w-72 max-w-full shrink-0 self-start overflow-auto rounded-xl border border-border bg-card p-3 text-xs text-card-foreground'
      }
    >
      {section ? (
        <>
          <Button variant="ghost" size="xs" onClick={() => setSection(null)}>
            <ArrowLeft />
            {t('components.nativeChatBackground.back', 'Back')}
          </Button>
          <h2 className="my-3 font-medium">{labels[section]}</h2>
          {section === 'environment' ? (
            <dl className="space-y-3 break-words">
              <div>
                <dt className="text-muted-foreground">
                  {t('components.nativeChatSummary.host', 'Execution host')}
                </dt>
                <dd>{host}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t('components.nativeChatSummary.directory', 'Working directory')}
                </dt>
                <dd>{props.fileContext?.worktreePath ?? unavailable}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t('components.nativeChatSummary.workspace', 'Workspace')}
                </dt>
                <dd>{worktreeId ?? unavailable}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t('components.nativeChatSummary.branch', 'Branch')}
                </dt>
                <dd>
                  {branch?.trim() ||
                    t(
                      'components.nativeChatSummary.noBranch',
                      'No branch reported (folder workspaces may have none).'
                    )}
                </dd>
              </div>
            </dl>
          ) : null}
          {section === 'context' ? (
            props.contextUsage ? (
              <div className="space-y-3">
                <p>
                  {summary.context} · {props.contextUsage.usedTokens.toLocaleString()} /{' '}
                  {props.contextUsage.windowTokens.toLocaleString()}{' '}
                  {t('components.nativeChatSummary.tokens', 'tokens')}
                </p>
                <p className="text-muted-foreground">
                  {props.contextUsage.estimated
                    ? t(
                        'components.nativeChatSummary.estimated',
                        'Estimated from the last provider response.'
                      )
                    : t('components.nativeChatSummary.providerReport', 'Reported by the provider.')}
                </p>
                {props.contextUsage.categories.map((category) => (
                  <p key={category.name}>
                    {category.name}: {category.tokens.toLocaleString()}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                {t(
                  'components.nativeChatSummary.contextUnavailable',
                  'The provider has not reported context occupancy.'
                )}
              </p>
            )
          ) : null}
          {section === 'results' ? (
            <div className="space-y-2">
              <p className="text-muted-foreground">
                {t(
                  'components.nativeChatSummary.loadedResults',
                  'File changes recorded in the loaded chat history.'
                )}
              </p>
              {results.length === 0 ? (
                <p>{t('components.nativeChatSummary.noResults', 'No file changes reported.')}</p>
              ) : (
                results.map((path) => (
                  <a
                    key={path}
                    className="block break-words underline"
                    href={createNativeChatFileHref(path, 'literal')}
                    onClick={(event) =>
                      props.onLinkClick?.(event, createNativeChatFileHref(path, 'literal'))
                    }
                  >
                    {path}
                  </a>
                ))
              )}
            </div>
          ) : null}
          {section === 'connectors' ? (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                {connectorSnapshot
                  ? t(
                      'components.nativeChatSummary.connectorObserved',
                      'Provider status at {{time}}.',
                      { time: new Date(connectorSnapshot.observedAt).toLocaleTimeString() }
                    )
                  : t(
                      'components.nativeChatSummary.connectorUnknown',
                      'Current connector status is not reported by this provider or host.'
                    )}
              </p>
              {currentConnectors?.map((connector) => (
                <NativeChatSessionConnectorRow
                  key={connector.name}
                  connector={connector}
                  expanded
                />
              ))}
              <p className="text-muted-foreground">
                {t('components.nativeChatSummary.connectorHistory', 'Recorded calls (historical)')}
              </p>
              {connectors.length === 0 ? (
                <p>
                  {t('components.nativeChatSummary.noConnectors', 'No connector calls reported.')}
                </p>
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
            </div>
          ) : null}
          {section === 'agents' && !views && legacyAgents.length === 0 ? (
            <p className="text-muted-foreground">
              {t(
                'components.nativeChatSummary.subagentsUnknown',
                'Subagent information is not reported by this provider or host.'
              )}
            </p>
          ) : null}
          {section === 'agents' && legacyAgents.length > 0 ? (
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
          ) : null}
          {(section === 'agents' && legacyAgents.length === 0) || section === 'commands' ? (
            <NativeChatCodexBackgroundPanel {...props} section={section} embedded />
          ) : null}
        </>
      ) : (
        <>
          <h2 className="mb-2 font-medium">
            {t('components.nativeChatSummary.title', 'Chat summary')}
          </h2>
          <div className="space-y-2">
            {(
              ['environment', 'context', 'results', 'agents', 'connectors', 'commands'] as const
            ).map((key) => (
              <section key={key} className="rounded-lg border border-border">
                <button
                  type="button"
                  className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent focus-visible:outline focus-visible:outline-ring"
                  onClick={() => setSection(key)}
                  aria-expanded={false}
                >
                  <span className="flex-1">{labels[key]}</span>
                  <span className="max-w-32 truncate text-muted-foreground">{summary[key]}</span>
                  <ChevronRight className="size-3 shrink-0" />
                </button>
                <div className="space-y-1 px-2 pb-2 text-muted-foreground">
                  {key === 'environment' ? (
                    <>
                      <p className="truncate" title={props.fileContext?.worktreePath}>
                        {props.fileContext?.worktreePath ?? unavailable}
                      </p>
                      <p className="truncate">
                        {branch?.trim() ||
                          t(
                            'components.nativeChatSummary.noBranch',
                            'No branch reported (folder workspaces may have none).'
                          )}
                      </p>
                    </>
                  ) : null}
                  {key === 'results'
                    ? results.slice(0, 3).map((path) => (
                        <p key={path} className="truncate" title={path}>
                          {path}
                        </p>
                      ))
                    : null}
                  {key === 'context' && props.contextUsage ? (
                    <p>
                      {props.contextUsage.usedTokens.toLocaleString()} /{' '}
                      {props.contextUsage.windowTokens.toLocaleString()}{' '}
                      {t('components.nativeChatSummary.tokens', 'tokens')}
                    </p>
                  ) : null}
                  {key === 'connectors' ? (
                    currentConnectors ? (
                      currentConnectors
                        .slice(0, 3)
                        .map((connector) => (
                          <NativeChatSessionConnectorRow
                            key={connector.name}
                            connector={connector}
                          />
                        ))
                    ) : (
                      <p className="text-muted-foreground">
                        {t(
                          'components.nativeChatSummary.connectorUnknown',
                          'Current connector status is not reported by this provider or host.'
                        )}
                      </p>
                    )
                  ) : null}
                  {key === 'connectors' && connectorSnapshot ? (
                    <p className="text-muted-foreground">
                      {t(
                        'components.nativeChatSummary.connectorObserved',
                        'Provider status at {{time}}.',
                        { time: new Date(connectorSnapshot.observedAt).toLocaleTimeString() }
                      )}
                    </p>
                  ) : null}
                  {key === 'commands'
                    ? commands?.slice(0, 3).map((command) => (
                        <p key={command.id} className="truncate">
                          {command.name ?? command.description ?? command.id} ·{' '}
                          {commandRows.find((row) => row.id === command.id)?.displayState ??
                            unavailable}
                        </p>
                      ))
                    : null}
                  {key === 'agents' ? (
                    <>
                      {agents.slice(0, 3).map((agent) => (
                        <p key={agent.id} className="truncate">
                          <span className="text-foreground">
                            {agent.name ?? agent.description ?? agent.id}
                          </span>{' '}
                          · {agent.recordedConfiguration?.model ?? unavailable} ·{' '}
                          {agent.recordedConfiguration?.effort ?? unavailable}
                        </p>
                      ))}
                      {legacyAgents.slice(0, 3).map(({ entry }) => (
                        <p key={entry.id} className="truncate">
                          {entry.label} · {unavailable} · {unavailable}
                        </p>
                      ))}
                    </>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
      {section === null || section === 'servers' ? (
        <NativeChatSessionServers
          target={props.target}
          worktreeId={worktreeId ?? null}
          expanded={section === 'servers'}
          onExpand={() => setSection('servers')}
        />
      ) : null}
    </aside>
  )
}
