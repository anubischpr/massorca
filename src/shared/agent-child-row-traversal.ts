import type { AgentChildRowModel } from './agent-child-row-model'

/** Every row of a tree, owners before what they own. */
export function flattenAgentChildRowModels(
  rows: readonly AgentChildRowModel[]
): AgentChildRowModel[] {
  return rows.flatMap((row) => [row, ...flattenAgentChildRowModels(row.owned)])
}
