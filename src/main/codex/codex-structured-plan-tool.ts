import {
  isCodexAppServerRequestError,
  type CodexAppServerConnection
} from './codex-app-server-connection'

// Codex 0.162 leaves update_plan out of a thread's tools unless asked, so no plan reaches the chat.
// A user's own `tools.update_plan.enabled` is not honoured: app-server `config/read` does not report
// it (probed on 0.162.1 with the key set in config.toml), so it cannot be told apart from unset.
const PLAN_TOOL_KEY = 'tools.update_plan.enabled'

type PlanToolConnection = Pick<CodexAppServerConnection, 'request'>

const planToolUnsupported = new WeakSet<object>()

/** An older app-server refusing the key by name; any other failure is not this proof. */
function isPlanToolUnsupported(error: unknown): boolean {
  return (
    isCodexAppServerRequestError(error) &&
    (error.code === -32600 || error.code === -32602) &&
    /update_plan/.test(error.message)
  )
}

/**
 * `thread/start` or `thread/resume` carrying the plan tool default. An app-server that refuses the
 * key is retried once without it and remembered for the life of the connection.
 */
export async function requestWithPlanTool(
  connection: PlanToolConnection,
  method: 'thread/start' | 'thread/resume',
  params: Record<string, unknown>,
  options: {
    threadConfig: Record<string, unknown> | undefined
    timeoutMs: number | undefined
  }
): Promise<unknown> {
  const withDefault = !planToolUnsupported.has(connection)
  const config = { ...(withDefault ? { [PLAN_TOOL_KEY]: true } : {}), ...options.threadConfig }
  const build = (carried: Record<string, unknown>): Record<string, unknown> => ({
    ...params,
    ...(Object.keys(carried).length > 0 ? { config: carried } : {})
  })
  try {
    return await connection.request(method, build(config), { timeoutMs: options.timeoutMs })
  } catch (error) {
    if (!withDefault || !isPlanToolUnsupported(error)) {
      throw error
    }
    planToolUnsupported.add(connection)
    return connection.request(method, build({ ...options.threadConfig }), {
      timeoutMs: options.timeoutMs
    })
  }
}
