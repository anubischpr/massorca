import { useTranslation } from 'react-i18next'
import type { AgentChildWorkView } from '../../../../shared/agent-status-child-work-view'
import { useMemo, useState } from 'react'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import { ArrowLeft } from 'lucide-react'
import { AgentStateDot } from '@/components/AgentStateDot'
import { Button } from '@/components/ui/button'
import { NativeChatToolLineDetail } from './NativeChatToolLine'
import { NativeChatCommandMetadata } from './NativeChatToolAnnotations'
import { nativeChatFullCommand } from './native-chat-tool-input-text'
import { nativeChatBackgroundCommandDetails } from './native-chat-background-command-details'
import type { AgentSessionBackgroundTaskState } from '../../../../shared/agent-session-wire'
import {
  buildAgentChildRowModels,
  buildLegacyTaskRowModels,
  type AgentChildRowContext,
  type AgentChildRowModel
} from '../../../../shared/agent-child-row-model'
import { AgentChildRowContent } from '@/components/AgentChildRowContent'
import { agentChildRowName } from '@/components/agent-child-row-text'
import { useNow } from '@/hooks/use-now'

const UNVERIFIABLE: AgentChildRowContext = {
  parentEvidenceFresh: false,
  transportObservation: 'unverifiable',
  parentObservedAt: 0,
  hostClockOffsetMs: 0
}

function BackgroundRow({
  row,
  now,
  onSelect
}: {
  row: AgentChildRowModel
  now: number
  onSelect: (row: AgentChildRowModel) => void
}) {
  const { t } = useTranslation()
  return (
    <li className="space-y-1">
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-2 text-left"
        data-background-state={row.displayState}
        onClick={() => onSelect(row)}
        aria-label={t('components.nativeChatBackground.viewActivity', 'View activity: {{label}}', {
          label: row.name || row.id
        })}
      >
        {row.kind === 'agent' ? (
          <>
            <AgentStateDot state={row.displayState} size="sm" />
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-24 max-w-full flex-1 truncate" title={agentChildRowName(row)}>
                {agentChildRowName(row)}
              </span>
              <span
                className="max-w-full shrink-0 break-words text-muted-foreground"
                title={
                  row.recordedConfiguration
                    ? t('components.nativeChatBackground.recorded', 'Recorded turn configuration')
                    : t(
                        'components.nativeChatBackground.recordedUnavailable',
                        'Recorded turn configuration unavailable'
                      )
                }
              >
                {row.recordedConfiguration?.model ??
                  t('components.nativeChatBackground.modelUnavailable', 'Model unavailable')}{' '}
                ·{' '}
                {row.recordedConfiguration?.effort ??
                  t('components.nativeChatBackground.effortUnavailable', 'Effort unavailable')}
              </span>
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
      {row.owned.length > 0 ? (
        <ul className="ml-3 space-y-2 border-l border-border pl-3">
          {row.owned.map((owned) => (
            <BackgroundRow key={owned.id} row={owned} now={now} onSelect={onSelect} />
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
  const main = rows.filter((row) => row.kind !== 'agent' && mainIds.has(row.id))
  const unknown = rows.filter((row) => row.kind !== 'agent' && !mainIds.has(row.id))
  const agents = rows.filter((row) => row.kind === 'agent')
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
        className="scrollbar-sleek h-full min-h-0 w-80 shrink-0 overflow-auto border-l border-border bg-background p-3 text-xs"
      >
        <Button variant="ghost" size="xs" onClick={() => setSelected(null)}>
          <ArrowLeft />
          {t('components.nativeChatBackground.back', 'Back')}
        </Button>
        <h2 className="my-3 font-medium text-foreground">
          {selected.row.name || t('components.nativeChatBackground.details', 'Activity details')}
        </h2>
        {context.transportObservation === 'unverifiable' || !context.parentEvidenceFresh ? (
          <p className="mb-3 text-muted-foreground">
            {t(
              'components.nativeChatBackground.hostUnavailable',
              'Host activity cannot currently be verified.'
            )}
          </p>
        ) : null}
        {commands.length === 0 ? (
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
      className="scrollbar-sleek mt-3 mr-3 max-h-64 w-80 max-w-full shrink-0 self-start overflow-auto rounded-xl border border-border bg-card p-3 text-xs text-card-foreground"
    >
      <h2 className="mb-3 font-medium text-foreground">
        {t('components.nativeChatBackground.title', 'Background activity')}
      </h2>
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
              <BackgroundRow key={row.id} row={row} now={now} onSelect={onSelect} />
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
              <BackgroundRow key={row.id} row={row} now={now} onSelect={onSelect} />
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
            {t('components.nativeChatBackground.subagent', 'Subagent')}
          </h3>
          <ul>
            <BackgroundRow row={row} now={now} onSelect={onSelect} />
          </ul>
        </section>
      ))}
    </aside>
  )
}
