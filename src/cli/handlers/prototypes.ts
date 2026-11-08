import type { CommandHandler } from '../dispatch'
import { getRequiredStringFlag } from '../flags'
import { formatDesignSystemReadability } from '../prototype-design-system-format'
import { checkDesignSystemReadability } from '../../shared/prototype-design-system-readability'
import type { ReadPrototypeDesignSystemResult } from '../../shared/rpc-contract/prototype-params'

export const PROTOTYPE_HANDLERS: Record<string, CommandHandler> = {
  'prototypes design-system': async ({ flags, client, json }) => {
    const sessionId = getRequiredStringFlag(flags, 'session')
    const response = await client.call<ReadPrototypeDesignSystemResult>(
      'prototypes.readDesignSystem',
      { sessionId }
    )
    const verdict = checkDesignSystemReadability(response.result)
    console.log(json ? JSON.stringify(verdict, null, 2) : formatDesignSystemReadability(verdict))
    // Why: a not-readable verdict exits 1, as `vm recipe doctor` does for a failing check.
    if (!verdict.readable) {
      process.exitCode = 1
    }
  }
}
