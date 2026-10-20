import { describe, expect, it } from 'vitest'
import {
  MAX_PLAN_DOCUMENT_SUMMARY,
  nativeChatPlanDocumentFromCall
} from './native-chat-plan-document'

const call = (artifact: unknown) => ({ Path: '/brain/plan.md', antigravityArtifact: artifact })

describe('nativeChatPlanDocumentFromCall', () => {
  it('reads a user-facing artifact and its approval request', () => {
    expect(
      nativeChatPlanDocumentFromCall(
        'write_file',
        call({ userFacing: true, requestFeedback: true, summary: ' Plan ' })
      )
    ).toEqual({ path: '/brain/plan.md', summary: 'Plan', awaitingApproval: true })
  })

  it('bounds the summary and does not await approval unless asked', () => {
    const document = nativeChatPlanDocumentFromCall(
      'edit_file',
      call({ userFacing: true, summary: 'x'.repeat(MAX_PLAN_DOCUMENT_SUMMARY + 50) })
    )
    expect(document?.summary).toHaveLength(MAX_PLAN_DOCUMENT_SUMMARY)
    expect(document?.awaitingApproval).toBe(false)
  })

  it('ignores a file not marked user-facing, other tools and calls without the field', () => {
    expect(nativeChatPlanDocumentFromCall('write_file', call({ userFacing: false }))).toBeNull()
    expect(nativeChatPlanDocumentFromCall('read_file', call({ userFacing: true }))).toBeNull()
    expect(nativeChatPlanDocumentFromCall('write_file', { Path: '/plan.md' })).toBeNull()
  })
})
