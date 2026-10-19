import type {
  AgentSessionHistoryResult,
  AgentSessionSubscribeEvent
} from '../../../../shared/agent-session-wire'
import { structuredRunningChildWork } from '../../../../shared/agent-child-work-listing'
import type { AgentChildWorkView } from '../../../../shared/agent-status-child-work-view'
import { AGENT_SESSION_SETTLED_CHILD_WORK_RUNTIME_CAPABILITY } from '../../../../shared/structured-agent-session-surface-capabilities'
import type { RpcContext } from '../core'

type SettledChildWorkReader = Pick<RpcContext, 'clientKind' | 'clientCapabilities'>

function readsSettledChildWork(ctx: SettledChildWorkReader): boolean {
  // An in-process caller is this build; only a negotiated client can predate the grouping.
  return (
    ctx.clientKind === undefined ||
    ctx.clientCapabilities?.includes(AGENT_SESSION_SETTLED_CHILD_WORK_RUNTIME_CAPABILITY) === true
  )
}

/** A reader that predates the finished group draws every row it is handed as work in progress, so
 *  it is given running children only, as it always was. */
function running(views: AgentChildWorkView[] | undefined): AgentChildWorkView[] | undefined {
  return views && structuredRunningChildWork(views)
}

export function projectSettledChildWorkHistory(
  result: AgentSessionHistoryResult,
  ctx: SettledChildWorkReader
): AgentSessionHistoryResult {
  if (readsSettledChildWork(ctx) || !result.page.commandActivity) {
    return result
  }
  return {
    ...result,
    page: { ...result.page, commandActivity: running(result.page.commandActivity) }
  }
}

export function projectSettledChildWorkEvent(
  event: AgentSessionSubscribeEvent,
  ctx: SettledChildWorkReader
): AgentSessionSubscribeEvent {
  if (readsSettledChildWork(ctx)) {
    return event
  }
  if (event.type === 'snapshot') {
    return {
      ...event,
      ...(event.commandActivity ? { commandActivity: running(event.commandActivity) } : {}),
      page: event.page.commandActivity
        ? { ...event.page, commandActivity: running(event.page.commandActivity) }
        : event.page
    }
  }
  return event.type === 'batch' && event.commandActivity
    ? { ...event, commandActivity: running(event.commandActivity) }
    : event
}
