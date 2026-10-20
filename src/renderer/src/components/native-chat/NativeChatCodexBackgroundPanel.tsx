import { useTranslation } from 'react-i18next'
import type { AgentChildWorkView } from '../../../../shared/agent-status-child-work-view'
import { useMemo, useState } from 'react'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import { ArrowLeft } from 'lucide-react'
import { AgentStateDot } from '@/components/AgentStateDot'
import { Button } from '@/components/ui/button'
import { NativeChatAgentChildDetails } from './NativeChatAgentChildDetails'
import { recordedConfigurationText } from './native-chat-recorded-configuration'
import { NativeChatToolLineDetail } from './NativeChatToolLine'
import { NativeChatCommandMetadata } from './NativeChatToolAnnotations'
import { nativeChatFullCommand } from './native-chat-tool-input-text'
import { nativeChatBackgroundCommandDetails } from './native-chat-background-command-details'
import type { AgentSessionBackgroundTaskState } from '../../../../shared/agent-session-wire'
import {
  buildAgentChildRowModels,
  buildLegacyTaskRowModels,
  type AgentChildRowContext,
  usableAgentChildLabel,
  type AgentChildRowModel
} from '../../../../shared/agent-child-row-model'
import { AgentChildRowContent } from '@/components/AgentChildRowContent'
import { agentChildRowName } from '@/components/agent-child-row-text'
import { useNow } from '@/hooks/use-now'
import { NativeChatFinishedBackgroundGroup } from './NativeChatFinishedBackgroundGroup'
import {
  NativeChatBackgroundTaskStopControl,
  type NativeChatBackgroundStop
} from './NativeChatBackgroundTaskStopControl'

export const UNVERIFIABLE: AgentChildRowContext = {
  parentEvidenceFresh: false,
  transportObservation: 'unverifiable',
  parentObservedAt: 0,
  hostClockOffsetMs: 0
}

/** Only a row the host reports as working now; waiting, blocked, monitoring and unverifiable rows are not. */
export function isRunningChildRow(row: Pick<AgentChildRowModel, 'displayState'>): boolean {
  return row.displayState === 'working'
}

/** A settled row with nothing left running: it moves under the collapsed "finished" group. */
export function isFinishedChildRow(row: Pick<AgentChildRowModel, 'displayState' | 'settled'>) {
  return (
    row.settled &&
    (row.displayState === 'done' ||
      row.displayState === 'failed' ||
      row.displayState === 'interrupted' ||
      row.displayState === 'idle')
  )
}

/** Sort comparator that lists running work ahead of settled work and keeps host order within each group. */
export function runningChildRowsFirst(left: AgentChildRowModel, right: AgentChildRowModel): number {
  return Number(isRunningChildRow(right)) - Number(isRunningChildRow(left))
}

function BackgroundRow({
  row,
  now,
  onSelect,
  stop
}: {
  row: AgentChildRowModel
  now: number
  onSelect: (row: AgentChildRowModel) => void
  /** Only a commands list offers a Stop; the subagent list draws none. */
  stop?: NativeChatBackgroundStop
}) {
  const { t } = useTranslation()
  return (
    <li className="space-y-1">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          data-background-state={row.displayState}
          onClick={() => onSelect(row)}
          aria-label={t(
            'components.nativeChatBackground.viewActivity',
            'View activity: {{label}}',
            {
              label: row.name || row.id
            }
          )}
        >
          {row.kind === 'agent' ? (
            <>
              <AgentStateDot state={row.displayState} size="sm" />
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className="min-w-24 max-w-full flex-1 truncate"
                  title={agentChildRowName(row)}
                >
                  {agentChildRowName(row)}
                </span>
                {recordedConfigurationText(row) ? (
                  <span
                    className="max-w-full shrink-0 break-words text-muted-foreground"
                    title={t(
                      'components.nativeChatBackground.recorded',
                      'Recorded turn configuration'
                    )}
                  >
                    {recordedConfigurationText(row)}
                  </span>
                ) : null}
              </span>
            </>
          ) : (
            <AgentChildRowContent
              row={row}
              now={now}
              leadClassName="text-foreground"
              trailClassName="text-muted-foreground"
              separator=" · "
              lineTitle
            />
          )}
        </button>
        {stop ? <NativeChatBackgroundTaskStopControl row={row} stop={stop} /> : null}
      </div>
      {row.owned.length > 0 ? (
        <ul className="ml-3 space-y-2 border-l border-border pl-3">
          {row.owned.map((owned) => (
            <BackgroundRow key={owned.id} row={owned} now={now} onSelect={onSelect} stop={stop} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function NativeChatCodexBackgroundPanel(props: {
  journalItems?: readonly AgentJournalRenderItem[]
  commandActivity?: AgentChildWorkView[]
  roster: AgentSessionBackgroundTaskState | null | undefined
  context?: AgentChildRowContext
  isVisible: boolean
  section?: 'agents' | 'commands'
  embedded?: boolean
  /** Stops for the commands list. Finished tasks never get one. */
  stop?: NativeChatBackgroundStop
}): React.JSX.Element {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<{
    row: AgentChildRowModel
    views: readonly AgentChildWorkView[]
  } | null>(null)
  const context = props.context ?? UNVERIFIABLE
  const views = props.commandActivity ?? props.roster?.children
  const rows = useMemo(() => {
    if (views !== undefined) {
      return buildAgentChildRowModels(views, context)
    }
    return buildLegacyTaskRowModels(
      props.roster?.tasks ?? [],
      props.roster?.settledTasks ?? []
    ).map((row) =>
      !row.settled &&
      (!context.parentEvidenceFresh || context.transportObservation === 'unverifiable')
        ? { ...row, displayState: 'unverifiable' as const }
        : row
    )
  }, [props.roster, views, context])
  const now = useNow(1_000, props.isVisible && rows.some((row) => !row.settled))
  const mainIds = new Set(views?.filter((view) => view.ownership === 'main').map((view) => view.id))
  const commandRows = rows.filter((row) => props.section !== 'agents' && row.kind !== 'agent')
  const main = commandRows
    .filter((row) => !isFinishedChildRow(row) && mainIds.has(row.id))
    .sort(runningChildRowsFirst)
  const unknown = commandRows
    .filter((row) => !isFinishedChildRow(row) && !mainIds.has(row.id))
    .sort(runningChildRowsFirst)
  const finishedCommands = commandRows.filter(isFinishedChildRow)
  const allAgents = rows.filter((row) => props.section !== 'commands' && row.kind === 'agent')
  const agents = allAgents.filter((row) => !isFinishedChildRow(row)).sort(runningChildRowsFirst)
  const finishedAgents = allAgents.filter(isFinishedChildRow)
  const onSelect = (row: AgentChildRowModel) => setSelected({ row, views: views ?? [] })
  if (selected) {
    const detailViews = [
      ...new Map([...selected.views, ...(views ?? [])].map((view) => [view.id, view])).values()
    ]
    const selectedView = detailViews.find((view) => view.id === selected.row.id)
    const commands =
      selectedView?.kind === 'command'
        ? [selectedView]
        : detailViews.filter(
            (view) => view.kind === 'command' && view.parentChildWorkId === selected.row.id
          )
    return (
      <aside
        aria-label={t('components.nativeChatBackground.details', 'Activity details')}
        className={
          props.embedded
            ? 'space-y-3 text-xs'
            : 'scrollbar-sleek h-full min-h-0 w-80 shrink-0 overflow-auto border-l border-border bg-background p-3 text-xs'
        }
      >
        <Button variant="ghost" size="xs" onClick={() => setSelected(null)}>
          <ArrowLeft />
          {t('components.nativeChatBackground.back', 'Back')}
        </Button>
        <h2 className="my-3 font-medium text-foreground">
          {selected.row.name || t('components.nativeChatBackground.details', 'Activity details')}
        </h2>
        {selected.row.kind === 'agent' ? (
          <NativeChatAgentChildDetails row={selected.row} view={selectedView} now={now} />
        ) : null}
        {selected.row.kind !== 'agent' && selectedView?.description ? (
          <p className="mb-3 whitespace-pre-wrap break-words">{selectedView.description}</p>
        ) : null}
        {selected.row.kind !== 'agent' && selectedView?.operation ? (
          <p className="mb-3 whitespace-pre-wrap break-words">
            {selectedView.operation.toolName}: {selectedView.operation.input}
          </p>
        ) : null}
        {context.transportObservation === 'unverifiable' || !context.parentEvidenceFresh ? (
          <p className="mb-3 text-muted-foreground">
            {t(
              'components.nativeChatBackground.hostUnavailable',
              'Host activity cannot currently be verified.'
            )}
          </p>
        ) : null}
        {selected.row.kind !== 'agent' && commands.length === 0 ? (
          <p className="text-muted-foreground">
            {t('components.nativeChatBackground.outputUnavailable', 'Command output unavailable.')}
          </p>
        ) : null}
        {commands.map((command) => {
          const detail = nativeChatBackgroundCommandDetails(
            command,
            detailViews,
            props.journalItems ?? []
          )
          return detail ? (
            <section
              key={command.id}
              aria-label={t('components.nativeChatBackground.commandDetails', 'Command details')}
              className="mb-3"
            >
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span>
                  {detail.call.state ??
                    t('components.nativeChatBackground.statusUnavailable', 'Status unavailable')}
                </span>
                <NativeChatCommandMetadata block={detail.call} />
              </div>
              <NativeChatToolLineDetail
                block={detail.call}
                body={detail.result}
                fullCommand={nativeChatFullCommand(detail.call.input)}
                results={[]}
              />
              {!detail.result ? (
                <p className="text-muted-foreground">
                  {t('components.nativeChatBackground.noOutput', 'No command output received.')}
                </p>
              ) : null}
            </section>
          ) : (
            <p key={command.id} className="text-muted-foreground">
              {t(
                'components.nativeChatBackground.outputUnavailable',
                'Command output unavailable.'
              )}
            </p>
          )
        })}
      </aside>
    )
  }
  return (
    <aside
      aria-label={t('components.nativeChatBackground.title', 'Background activity')}
      className={
        props.embedded
          ? 'space-y-3 text-xs'
          : 'scrollbar-sleek mt-3 mr-3 max-h-64 w-80 max-w-full shrink-0 self-start overflow-auto rounded-xl border border-border bg-card p-3 text-xs text-card-foreground'
      }
    >
      {props.embedded ? null : (
        <h2 className="mb-3 font-medium text-foreground">
          {t('components.nativeChatBackground.title', 'Background activity')}
        </h2>
      )}
      {context.transportObservation === 'unverifiable' || !context.parentEvidenceFresh ? (
        <p className="mb-3 text-muted-foreground">
          {t(
            'components.nativeChatBackground.hostUnavailable',
            'Host activity cannot currently be verified.'
          )}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-muted-foreground">
          {t('components.nativeChatBackground.empty', 'No background work reported.')}
        </p>
      ) : null}
      {main.length > 0 ? (
        <section aria-label={t('components.nativeChatBackground.main', 'Main agent')}>
          <h3 className="mb-2 font-medium text-muted-foreground">
            {t('components.nativeChatBackground.main', 'Main agent')}
          </h3>
          <ul className="space-y-2">
            {main.map((row) => (
              <BackgroundRow
                key={row.id}
                row={row}
                now={now}
                onSelect={onSelect}
                stop={props.stop}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {unknown.length > 0 ? (
        <section
          aria-label={t('components.nativeChatBackground.originUnavailable', 'Origin unavailable')}
        >
          <h3 className="mb-2 font-medium text-muted-foreground">
            {t('components.nativeChatBackground.originUnavailable', 'Origin unavailable')}
          </h3>
          <ul className="space-y-2">
            {unknown.map((row) => (
              <BackgroundRow
                key={row.id}
                row={row}
                now={now}
                onSelect={onSelect}
                stop={props.stop}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {agents.map((row) => (
        <section
          key={row.id}
          aria-label={t('components.nativeChatBackground.subagentLabel', 'Subagent: {{label}}', {
            label: agentChildRowName(row)
          })}
          className="mt-3"
        >
          <h3 className="mb-2 font-medium text-muted-foreground">
            {usableAgentChildLabel(row.agentType) ??
              t('components.nativeChatBackground.subagent', 'Subagent')}
          </h3>
          <ul>
            <BackgroundRow row={row} now={now} onSelect={onSelect} />
          </ul>
        </section>
      ))}
      {finishedCommands.length > 0 ? (
        <NativeChatFinishedBackgroundGroup count={finishedCommands.length}>
          {finishedCommands.map((row) => (
            <BackgroundRow key={row.id} row={row} now={now} onSelect={onSelect} />
          ))}
        </NativeChatFinishedBackgroundGroup>
      ) : null}
      {finishedAgents.length > 0 ? (
        <NativeChatFinishedBackgroundGroup count={finishedAgents.length}>
          {finishedAgents.map((row) => (
            <BackgroundRow key={row.id} row={row} now={now} onSelect={onSelect} />
          ))}
        </NativeChatFinishedBackgroundGroup>
      ) : null}
    </aside>
  )
}
