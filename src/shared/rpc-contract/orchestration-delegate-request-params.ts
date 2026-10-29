import { z } from 'zod'
import { OptionalBoolean, OptionalString, requiredString } from './rpc-param-primitives'

/** The longest task summary the router is given; a longer one is a prompt, not an abstract. */
export const DELEGATION_SUMMARY_MAX_CHARS = 160

/** `orchestration.delegateRequest`: a chat asks for a child session, to be run on the agent its user picks. */
export const DelegateRequestParams = z.object({
  /** A short task abstract the router classifies; it never carries secrets or paths. */
  summary: requiredString('Missing --summary'),
  /** The full task text the child receives. */
  prompt: requiredString('Missing --prompt'),
  title: OptionalString,
  /** Whether the child will edit code, which decides where it runs. */
  writes: OptionalBoolean,
  from: OptionalString
})

export type DelegateRequestInput = z.infer<typeof DelegateRequestParams>

export type DelegateRequestResult = {
  requestId: string
  status: 'awaiting_choice'
  /** The journal key of the choice card in the parent chat. */
  questionItemId: string
}
