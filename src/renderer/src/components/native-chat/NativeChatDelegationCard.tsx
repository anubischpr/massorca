import { useId, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { translate } from '@/i18n/i18n'
import { AgentIcon } from '@/lib/agent-catalog'
import { cn } from '@/lib/utils'
import type { AgentSessionPromptResponse } from '../../../../shared/agent-session-question-answer'
import {
  DELEGATION_AUTOMATIC_OPTION_ID,
  delegationAgentOptionId,
  type DelegationCardPayload
} from '../../../../shared/delegated-session-journal'
import { isTuiAgent } from '../../../../shared/tui-agent-config'
import {
  automaticPickedHeading,
  defaultDelegationOption,
  delegationAutomaticFacts,
  delegationManualFacts,
  delegationOptionRows,
  type DelegationFact,
  type DelegationOptionRow
} from './native-chat-delegation-card-model'
import { useNativeChatPromptCardFocus } from './use-native-chat-prompt-card-focus'

/**
 * The host's agent-choice card for a delegated session: each agent with its usage, and the "why"
 * detail for the picked row. The answer names the picked option, which the host validates.
 */
export function NativeChatDelegationCard({
  body,
  question,
  questionId,
  isSubmitting = false,
  onAnswer,
  onCancel,
  shouldFocus = false
}: {
  body: DelegationCardPayload
  question: string
  questionId: string
  isSubmitting?: boolean
  onAnswer: (response: AgentSessionPromptResponse) => void
  onCancel: () => void
  shouldFocus?: boolean
}): React.JSX.Element {
  const cardRef = useRef<HTMLDivElement>(null)
  useNativeChatPromptCardFocus(cardRef, shouldFocus)
  const baseId = useId()
  const rows = delegationOptionRows(body)
  const [selectedId, setSelectedId] = useState<string | null>(() => defaultDelegationOption(body))
  const detail = selectedDetail(body, selectedId)
  const start = (): void => {
    if (selectedId !== null && !isSubmitting) {
      onAnswer({ kind: 'answers', answers: [{ questionId, optionIds: [selectedId] }] })
    }
  }

  return (
    <div
      ref={cardRef}
      data-native-chat-prompt-card-focus={shouldFocus || undefined}
      role="group"
      aria-label={question}
      aria-busy={isSubmitting}
      tabIndex={-1}
      className="shrink-0 bg-chat-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <div className="mx-auto w-full max-w-(--chat-content-max-width) px-3 pt-2 pb-4 sm:px-4">
        <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 text-sm font-semibold text-foreground">{question}</p>
            <span className="shrink-0 text-xs text-muted-foreground">
              {translate(
                'components.native-chat.delegation.connected',
                'Connected on this computer'
              )}
            </span>
          </div>
          <RadioGroup
            aria-label={translate('components.native-chat.delegation.choices', 'Agent choices')}
            value={selectedId ?? ''}
            onValueChange={setSelectedId}
            disabled={isSubmitting}
            className="sm:grid-cols-2"
          >
            {rows.map((row, index) => (
              <DelegationOptionTile
                key={row.optionId}
                id={`${baseId}-${index}`}
                row={row}
                selected={row.optionId === selectedId}
                disabled={isSubmitting}
              />
            ))}
          </RadioGroup>
          {detail ? <DelegationFacts heading={detail.heading} facts={detail.facts} /> : null}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              {translate('components.native-chat.question.cancel', 'Cancel')}
            </Button>
            <Button onClick={start} disabled={selectedId === null || isSubmitting}>
              {isSubmitting
                ? translate('components.native-chat.delegation.starting', 'Starting…')
                : translate('components.native-chat.delegation.start', 'Start child session')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function selectedDetail(
  body: DelegationCardPayload,
  selectedId: string | null
): { heading: string | null; facts: DelegationFact[] } | null {
  if (selectedId === DELEGATION_AUTOMATIC_OPTION_ID && body.decision) {
    return {
      heading: automaticPickedHeading(body, body.decision.agent),
      facts: delegationAutomaticFacts(body, body.decision)
    }
  }
  const agent = body.agents.find((entry) => delegationAgentOptionId(entry.agent) === selectedId)
  return agent ? { heading: null, facts: delegationManualFacts(body, agent) } : null
}

function DelegationOptionTile({
  id,
  row,
  selected,
  disabled
}: {
  id: string
  row: DelegationOptionRow
  selected: boolean
  disabled: boolean
}): React.JSX.Element {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-w-0 items-center gap-3 rounded-md border px-3 py-2.5 transition-colors',
        selected ? 'border-primary bg-accent' : 'border-border hover:bg-accent/60',
        disabled ? 'cursor-default opacity-60' : 'cursor-pointer'
      )}
    >
      <RadioGroupItem id={id} value={row.optionId} disabled={disabled} />
      <span className="flex size-6 shrink-0 items-center justify-center">
        {row.agentId === null ? (
          <Sparkles aria-hidden="true" className="size-4 text-muted-foreground" />
        ) : isTuiAgent(row.agentId) ? (
          <AgentIcon agent={row.agentId} size={16} />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{row.label}</span>
          <span
            className={cn(
              'shrink-0 text-xs',
              row.excluded ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {row.usageText}
          </span>
        </span>
        {row.barPercent === null ? null : (
          <span className="block h-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${row.barPercent}%` }}
            />
          </span>
        )}
        <span className="block truncate text-xs text-muted-foreground">{row.detail}</span>
      </span>
    </label>
  )
}

function DelegationFacts({
  heading,
  facts
}: {
  heading: string | null
  facts: readonly DelegationFact[]
}): React.JSX.Element {
  return (
    <div className="space-y-2 rounded-md bg-muted/50 p-3">
      {heading ? <p className="text-sm font-medium text-foreground">{heading}</p> : null}
      <dl className={cn('grid grid-cols-2 gap-3', facts.length > 2 && 'sm:grid-cols-4')}>
        {facts.map((fact) => (
          <div key={fact.title} className="min-w-0 space-y-1">
            <dt className="text-xs text-muted-foreground">{fact.title}</dt>
            <dd
              className={cn(
                'break-words text-sm text-foreground',
                fact.mono && 'font-mono text-xs'
              )}
            >
              {fact.value}
            </dd>
            {fact.lines.map((line) => (
              <dd key={line} className="break-words text-xs text-muted-foreground">
                {line}
              </dd>
            ))}
          </div>
        ))}
      </dl>
    </div>
  )
}
