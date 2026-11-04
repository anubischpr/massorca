import { z } from 'zod'
import type {
  MarketplaceCustomKind,
  MarketplaceCustomPlatform
} from '../../../shared/marketplace-custom'
import { parseServerUrl } from '../marketplace-apps-args'
import {
  MAX_CUSTOM_COMMAND_LENGTH,
  isControlCharacter,
  parseCustomCommandArgv
} from './custom-command-argv'

export const MAX_CUSTOM_NAME_LENGTH = 80

const PLATFORMS = [
  'win32',
  'darwin',
  'linux'
] as const satisfies readonly MarketplaceCustomPlatform[]

/** An add request that passed every check; the service never sees raw text. */
export type CustomItemDraft = {
  kind: MarketplaceCustomKind
  name: string
  checkCommand: readonly string[] | null
  install: Partial<Record<MarketplaceCustomPlatform, readonly string[]>>
  skillUrl?: string
}

type InstallText = Partial<Record<MarketplaceCustomPlatform, string>>

const commandText = z.string().max(MAX_CUSTOM_COMMAND_LENGTH).optional()

const addArgsSchema = z.strictObject({
  kind: z.enum(['tool', 'agent', 'skill']),
  name: z.string().max(200),
  checkCommand: commandText,
  install: z
    .strictObject({ win32: commandText, darwin: commandText, linux: commandText })
    .optional(),
  skillUrl: z.string().max(2_048).optional()
})

const idArgsSchema = z.strictObject({ id: z.string().min(1).max(64) })

/** A value the board left blank counts as absent. */
function present(text: string | undefined): string | undefined {
  return text === undefined || text.trim() === '' ? undefined : text
}

function isValidName(name: string): boolean {
  return (
    name.length > 0 && name.length <= MAX_CUSTOM_NAME_LENGTH && ![...name].some(isControlCharacter)
  )
}

function parseInstall(
  text: InstallText | undefined
): Partial<Record<MarketplaceCustomPlatform, readonly string[]>> | null {
  const install: Partial<Record<MarketplaceCustomPlatform, readonly string[]>> = {}
  for (const platform of PLATFORMS) {
    const value = present(text?.[platform])
    if (value === undefined) {
      continue
    }
    const argv = parseCustomCommandArgv(value)
    if (argv === null) {
      return null
    }
    install[platform] = argv
  }
  return install
}

/** The draft for a valid "Add custom" request, or null for anything the board may not store. */
export function parseAddArgs(input: unknown): CustomItemDraft | null {
  const parsed = addArgsSchema.safeParse(input)
  if (!parsed.success) {
    return null
  }
  const { kind } = parsed.data
  const name = parsed.data.name.trim()
  const install = parseInstall(parsed.data.install)
  const checkText = present(parsed.data.checkCommand)
  const urlText = present(parsed.data.skillUrl)
  if (!isValidName(name) || install === null) {
    return null
  }
  if (kind === 'skill') {
    // Why: a skill is installed from its link, so it carries no check or install commands.
    const skillUrl = urlText === undefined ? null : parseServerUrl(urlText)
    if (skillUrl === null || checkText !== undefined || Object.keys(install).length > 0) {
      return null
    }
    return { kind, name, checkCommand: null, install: {}, skillUrl }
  }
  // Why: a tool or agent without a check command could never be detected.
  if (urlText !== undefined || checkText === undefined) {
    return null
  }
  const checkCommand = parseCustomCommandArgv(checkText)
  return checkCommand === null ? null : { kind, name, checkCommand, install }
}

export function parseIdArgs(input: unknown): string | null {
  const parsed = idArgsSchema.safeParse(input)
  return parsed.success ? parsed.data.id : null
}

/** The key an install command is stored under, or null where no platform key exists. */
export function marketplacePlatform(platform: NodeJS.Platform): MarketplaceCustomPlatform | null {
  return platform === 'win32' || platform === 'darwin' || platform === 'linux' ? platform : null
}
