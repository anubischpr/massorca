import { z } from 'zod'
import { bindDeferredRpcOperation, defineRpcOperation } from '../transport/rpc-operation'
import { rpcResultVariant } from '../transport/rpc-operation-result-reader'

// `agentSessionChecklist.*`: the person's checks, notes and screenshots on a chat's checklist, kept
// by the host that owns the chat. The agent's items come from its replies, never from these calls.

const screenshotSchema = z.object({ path: z.string(), name: z.string() })

const markSchema = z.object({
  text: z.string(),
  checked: z.boolean().optional(),
  checkedAt: z.number().optional(),
  note: z.string().optional(),
  screenshots: z.array(screenshotSchema).optional(),
  noteAt: z.number().optional(),
  revision: z.number()
})

const personStateSchema = z.object({
  revision: z.number(),
  deliveredRevision: z.number(),
  title: z.string().nullable(),
  marks: z.record(z.string(), markSchema)
})

// A newer host may answer other refusals; each still reads as "no state here".
const checklistReplySchema = z.union([
  z.object({ ok: z.literal(true), state: personStateSchema }),
  z.object({ ok: z.literal(false), error: z.string() })
])

/** Reads the person's marks for a chat. An older host answers with an error reply, not a state. */
export const agentSessionChecklistRead = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'agent-session-checklist.read',
    method: 'agentSessionChecklist.read',
    acceptance: 'object-result-or-null',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('agent-session-checklist-state', checklistReplySchema)
  })
)

/** Sets one item's checks, note or screenshots; answers the whole state so the phone can apply it. */
export const agentSessionChecklistSetItem = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'agent-session-checklist.set-item',
    method: 'agentSessionChecklist.setItem',
    acceptance: 'object-result-or-null',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('agent-session-checklist-state', checklistReplySchema)
  })
)
