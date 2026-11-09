import { z } from 'zod'

// Why: new method names, so a host that predates them answers `method_not_found` and clients ask for an update.
export const MARKETPLACE_PROGRAM_STATUS_METHOD = 'marketplace.program.status'
export const MARKETPLACE_PROGRAM_INSTALL_METHOD = 'marketplace.program.install'
export const MARKETPLACE_PROGRAM_UNINSTALL_METHOD = 'marketplace.program.uninstall'
// Why a method and not an install flag: an older host would drop the flag and answer a plain install, which does nothing for a program that is already there.
export const MARKETPLACE_PROGRAM_REINSTALL_METHOD = 'marketplace.program.reinstall'

/** The programs the Marketplace installs on a host. Gentle Shell is the `pi` agent's Gentle Shell runtime. */
export const MARKETPLACE_HOST_PROGRAM_IDS = [
  'claude',
  'codex',
  'antigravity',
  'gentle-shell',
  'git',
  'gh',
  'node'
] as const
export type MarketplaceHostProgramId = (typeof MARKETPLACE_HOST_PROGRAM_IDS)[number]

const MAX_HOST_KEY_LENGTH = 256

/** A host key as the Marketplace host picker names it; absent or `local` is the machine that answers. */
export const MarketplaceHostProgramHost = z.union([
  z.literal('local'),
  z
    .string()
    .max(MAX_HOST_KEY_LENGTH)
    .regex(/^(ssh|runtime|wsl):.+$/)
])

export const MarketplaceHostProgramParams = z.object({
  program: z.enum(MARKETPLACE_HOST_PROGRAM_IDS),
  host: MarketplaceHostProgramHost.optional()
})
export type MarketplaceHostProgramParamsValue = z.infer<typeof MarketplaceHostProgramParams>

/** How the program on a host was installed; `unknown` covers copied binaries and installers MassOrca cannot name. */
export const MARKETPLACE_HOST_PROGRAM_METHODS = [
  'winget',
  'brew',
  'npm',
  'apt',
  'dnf',
  'script',
  'version-manager',
  'unknown'
] as const
export type MarketplaceHostProgramMethod = (typeof MARKETPLACE_HOST_PROGRAM_METHODS)[number]

export const MARKETPLACE_HOST_PROGRAM_FAILURES = [
  'needs-admin',
  'unsupported',
  'failed',
  'not-installed',
  'host-needs-update',
  'unreachable'
] as const
export type MarketplaceHostProgramFailure = (typeof MARKETPLACE_HOST_PROGRAM_FAILURES)[number]

const MAX_TEXT_LENGTH = 600

const FailureSchema = z.object({
  ok: z.literal(false),
  reason: z.enum(MARKETPLACE_HOST_PROGRAM_FAILURES),
  message: z.string().max(MAX_TEXT_LENGTH).optional(),
  /** The exact command to run by hand on that host, when one exists. */
  command: z.string().max(MAX_TEXT_LENGTH).optional()
})

export const MarketplaceHostProgramResultSchema = z.union([
  z.object({
    ok: z.literal(true),
    version: z.string().max(200).optional(),
    /** What a removal took away or left, in plain words. */
    message: z.string().max(MAX_TEXT_LENGTH).optional()
  }),
  FailureSchema
])
export type MarketplaceHostProgramResult = z.infer<typeof MarketplaceHostProgramResultSchema>

export const MarketplaceHostProgramStatusSchema = z.union([
  z.object({
    ok: z.literal(true),
    installed: z.boolean(),
    version: z.string().max(200).optional(),
    path: z.string().max(1024).optional(),
    method: z.enum(MARKETPLACE_HOST_PROGRAM_METHODS).optional(),
    /** The command Install would run, or the one to run by hand when MassOrca cannot. */
    installCommand: z.string().max(MAX_TEXT_LENGTH).optional(),
    uninstallCommand: z.string().max(MAX_TEXT_LENGTH).optional(),
    /** Why Install or Uninstall is not offered on this host. */
    note: z.string().max(MAX_TEXT_LENGTH).optional(),
    canInstall: z.boolean(),
    canUninstall: z.boolean(),
    /** Set for a copy MassOrca can move to its managed install. */
    canReinstall: z.boolean().optional(),
    reinstallCommand: z.string().max(MAX_TEXT_LENGTH).optional()
  }),
  FailureSchema
])
export type MarketplaceHostProgramStatus = z.infer<typeof MarketplaceHostProgramStatusSchema>

/** Rebuilds an answer from the known fields; anything else reads as a failed call. */
export function readMarketplaceHostProgramResult(answer: unknown): MarketplaceHostProgramResult {
  const parsed = MarketplaceHostProgramResultSchema.safeParse(answer)
  return parsed.success ? parsed.data : { ok: false, reason: 'failed' }
}

export function readMarketplaceHostProgramStatus(answer: unknown): MarketplaceHostProgramStatus {
  const parsed = MarketplaceHostProgramStatusSchema.safeParse(answer)
  return parsed.success ? parsed.data : { ok: false, reason: 'failed' }
}
