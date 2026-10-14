import type { AgentChildWorkView } from './agent-status-child-work-view'
import { decodeAgentChildWorkViews } from './agent-status-child-work-view-wire'

/** A new subscription cannot inherit a claim omitted by an older host. */
export function readCommandActivity(
  previous: { commandActivity?: AgentChildWorkView[] },
  published: { commandActivity?: AgentChildWorkView[] },
  opensSubscription?: boolean
): AgentChildWorkView[] | undefined {
  if (published.commandActivity !== undefined) {
    return decodeAgentChildWorkViews(published.commandActivity)
  }
  return opensSubscription ? undefined : previous.commandActivity
}
