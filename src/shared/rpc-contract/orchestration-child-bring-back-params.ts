import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

/** `delegation.bringBack*`: one delegated child, named by its request. */
export const ChildBringBackParams = z.object({
  requestId: requiredString('Missing requestId')
})
