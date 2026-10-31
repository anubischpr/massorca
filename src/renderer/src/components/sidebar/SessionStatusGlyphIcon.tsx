import React from 'react'
import { AgentStateDot, type AgentDotState } from '@/components/AgentStateDot'
import { StateIndicatorTooltip } from '@/components/StateIndicatorTooltip'
import { translate } from '@/i18n/i18n'
import type { SessionStatusGlyph } from './worktree-session-status'

const AGENT_DOT_STATE_BY_GLYPH: Record<Exclude<SessionStatusGlyph, 'unread'>, AgentDotState> = {
  'needs-human': 'waiting',
  failed: 'failed',
  working: 'working',
  monitoring: 'monitoring',
  unconfirmed: 'unconfirmed'
}

/** The one status mark at the right edge of a one-line row. Reuses the agent-state glyphs. */
export const SessionStatusGlyphIcon = React.memo(function SessionStatusGlyphIcon({
  glyph,
  tooltipSide = 'right'
}: {
  glyph: SessionStatusGlyph
  tooltipSide?: React.ComponentProps<typeof StateIndicatorTooltip>['side']
}): React.JSX.Element {
  if (glyph === 'unread') {
    const label = translate('auto.components.sidebar.SessionStatusGlyphIcon.unread', 'Unread')
    return (
      <StateIndicatorTooltip label={label} side={tooltipSide}>
        <span
          className="inline-flex size-2.5 shrink-0 items-center justify-center"
          data-session-status-glyph="unread"
          aria-label={label}
        >
          <span className="block size-1.5 rounded-full bg-status-amber" />
        </span>
      </StateIndicatorTooltip>
    )
  }
  return (
    <span className="inline-flex shrink-0" data-session-status-glyph={glyph}>
      <AgentStateDot state={AGENT_DOT_STATE_BY_GLYPH[glyph]} size="sm" tooltipSide={tooltipSide} />
    </span>
  )
})
