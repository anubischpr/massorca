import type { HandlerContext } from '../dispatch'
import { RuntimeClientError, type RuntimeRpcSuccess } from '../runtime-client'

function isMethodNotFound(error: unknown): boolean {
  return error instanceof RuntimeClientError && error.code === 'method_not_found'
}

/** One host RPC call; an older host's `method_not_found` reads as "update MassOrca there first". */
export async function callMarketplaceHost<TResult = unknown>(
  ctx: HandlerContext,
  method: string,
  params?: unknown,
  options?: { timeoutMs?: number }
): Promise<RuntimeRpcSuccess<TResult>> {
  try {
    return await (options
      ? ctx.client.call<TResult>(method, params, options)
      : ctx.client.call<TResult>(method, params))
  } catch (error) {
    if (isMethodNotFound(error)) {
      throw new RuntimeClientError(
        'method_not_found',
        `This host's MassOrca predates "${method}". Update MassOrca on the host first.`
      )
    }
    throw error
  }
}

/** Like `callMarketplaceHost`, but a host without the method answers null so one row reads "unknown". */
export async function callMarketplaceHostOptional<TResult>(
  ctx: HandlerContext,
  method: string,
  params?: unknown
): Promise<RuntimeRpcSuccess<TResult> | null> {
  try {
    return await ctx.client.call<TResult>(method, params)
  } catch (error) {
    if (isMethodNotFound(error)) {
      return null
    }
    throw error
  }
}
