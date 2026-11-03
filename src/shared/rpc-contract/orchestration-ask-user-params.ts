import { z } from 'zod'
import type { AskUserAnswer } from '../agent-ask-user-journal'
import { OptionalFiniteNumber, OptionalString, requiredString } from './rpc-param-primitives'

/** `orchestration.askUser`: a chat's agent asks its person a question on the chat's own card. */
export const AskUserParams = z.object({
  /** The questions as JSON text: `{questions:[{question, options, multiSelect?}]}` or the bare array. */
  questions: requiredString('Missing --questions'),
  timeoutMs: OptionalFiniteNumber,
  from: OptionalString
})

export type AskUserInput = z.infer<typeof AskUserParams>

export type AskUserResult =
  | { status: 'answered'; questionItemId: string; answers: AskUserAnswer[]; answer: string }
  | { status: 'cancelled' | 'timedOut'; questionItemId: string }
