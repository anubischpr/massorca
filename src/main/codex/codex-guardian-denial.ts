import { readRecord, readString } from './codex-item-field-readers'

/** A denied auto-review the thread is still waiting on the user to overrule. */
export type CodexGuardianDenial = { threadId: string; params: Record<string, unknown> }

function snake(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

/** Keys become snake_case at every depth; the values that name a variant (`type`, `source`) too. */
function toCoreShape(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => toCoreShape(entry))
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entry]) => [
        snake(entryKey),
        toCoreShape(entry, entryKey)
      ])
    )
  }
  return typeof value === 'string' && (key === 'type' || key === 'source') ? snake(value) : value
}

/** The denial an `item/autoApprovalReview/completed` frame reports, or null for any other frame. */
export function codexGuardianDenialOf(method: string, params: unknown): CodexGuardianDenial | null {
  if (method !== 'item/autoApprovalReview/completed') {
    return null
  }
  const record = readRecord(params)
  const threadId = readString(record, 'threadId')
  return threadId !== null && readRecord(record.review).status === 'denied'
    ? { threadId, params: record }
    : null
}

/** The assessment event `thread/approveGuardianDeniedAction` takes, rebuilt from the frame that
 *  reported the denial: the app-server publishes the event under the notification's names. */
export function codexGuardianAssessmentEvent(denial: CodexGuardianDenial): Record<string, unknown> {
  const { params } = denial
  const review = readRecord(params.review)
  return {
    id: params.reviewId,
    target_item_id: params.targetItemId ?? null,
    turn_id: params.turnId,
    status: 'denied',
    risk_level: typeof review.riskLevel === 'string' ? snake(review.riskLevel) : null,
    user_authorization:
      typeof review.userAuthorization === 'string' ? snake(review.userAuthorization) : null,
    rationale: review.rationale ?? null,
    decision_source:
      typeof params.decisionSource === 'string' ? snake(params.decisionSource) : null,
    action: toCoreShape(params.action)
  }
}
