import { z } from 'zod'

export const PiLaunchPolicyShape = {
  piRuntime: z.enum(['pi', 'gentle-shell']).optional(),
  accessMode: z.enum(['default', 'full-access']).optional()
}

export function piLaunchPolicyMatchesAgent(value: {
  agent: string
  piRuntime?: string
  accessMode?: string
}): boolean {
  return (value.piRuntime === undefined && value.accessMode === undefined) || value.agent === 'pi'
}
