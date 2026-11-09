import { translate } from '@/i18n/i18n'
import type {
  MarketplaceHostProgramId,
  MarketplaceHostProgramMethod
} from '../../../../shared/rpc-contract/marketplace-host-program-params'
import type { HostProgramFailure } from './use-marketplace-host-program'

const COPY = 'auto.components.marketplace.MarketplaceHostProgram'

// Product names stay as the makers write them; Gentle Shell is never called Pi.
const NAMES: Record<MarketplaceHostProgramId, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  antigravity: 'Antigravity',
  'gentle-shell': 'Gentle Shell',
  git: 'Git',
  gh: 'GitHub CLI',
  node: 'Node.js'
}

// Where each program keeps what the person made with it, which Uninstall never touches.
const KEPT_DATA: Partial<Record<MarketplaceHostProgramId, string>> = {
  claude: '~/.claude',
  codex: '~/.codex',
  'gentle-shell': '~/.gentle-shell',
  gh: '~/.config/gh'
}

export function hostProgramName(program: MarketplaceHostProgramId): string {
  return NAMES[program]
}

export function hostProgramMethodLabel(method: MarketplaceHostProgramMethod): string {
  switch (method) {
    case 'winget':
      return 'winget'
    case 'brew':
      return 'Homebrew'
    case 'npm':
      return 'npm'
    case 'apt':
      return 'apt'
    case 'dnf':
      return 'dnf'
    case 'script':
      return translate(`${COPY}.methodScript`, "the vendor's installer")
    case 'version-manager':
      return translate(`${COPY}.methodVersionManager`, 'a version manager')
    case 'unknown':
      return translate(`${COPY}.methodUnknown`, 'an unknown installer')
  }
}

/** What the confirm step tells the person Uninstall removes and what it leaves alone. */
export function hostProgramConfirmText(
  program: MarketplaceHostProgramId,
  host: string,
  command: string | undefined
): string {
  const name = NAMES[program]
  const kept = KEPT_DATA[program]
  const base = kept
    ? translate(
        `${COPY}.confirmKeepsData`,
        'This removes the {{name}} program from {{host}}. Your data in {{kept}} stays.',
        { name, host, kept }
      )
    : translate(
        `${COPY}.confirm`,
        'This removes the {{name}} program from {{host}}. Nothing else is deleted.',
        { name, host }
      )
  const needs =
    program === 'node' || program === 'git'
      ? ` ${translate(
          `${COPY}.confirmNeeded`,
          'Other programs on {{host}} may need {{name}} to run.',
          { name, host }
        )}`
      : ''
  const run = command
    ? ` ${translate(`${COPY}.confirmRuns`, 'MassOrca will run: {{command}}', { command })}`
    : ''
  return `${base}${needs}${run}`
}

export function hostProgramFailureText(
  failure: HostProgramFailure,
  program: MarketplaceHostProgramId,
  host: string
): string {
  const name = NAMES[program]
  switch (failure.reason) {
    case 'needs-admin':
      return translate(
        `${COPY}.needsAdmin`,
        '{{name}} needs an administrator on {{host}}. MassOrca never asks for a password, so run this there yourself.',
        { name, host }
      )
    case 'unsupported':
      return (
        failure.message ??
        translate(`${COPY}.unsupported`, 'MassOrca cannot do this on {{host}}.', { host })
      )
    case 'not-installed':
      return translate(`${COPY}.notInstalled`, '{{name}} is not installed on {{host}}.', {
        name,
        host
      })
    case 'host-needs-update':
      return translate(`${COPY}.hostNeedsUpdate`, 'Update MassOrca on {{host}} first.', { host })
    case 'unreachable':
      return translate(`${COPY}.unreachable`, 'Could not reach {{host}}.', { host })
    case 'failed':
      return failure.message
        ? translate(`${COPY}.failedWith`, 'It did not finish: {{message}}', {
            message: failure.message
          })
        : translate(`${COPY}.failed`, 'It did not finish.')
  }
}

/** What the page says when the host could not even be asked about the program. */
export function hostProgramStatusFailureText(
  failure: HostProgramFailure,
  program: MarketplaceHostProgramId,
  host: string
): string {
  return failure.reason === 'failed'
    ? translate(`${COPY}.couldNotCheck`, 'Could not check {{name}} on {{host}}.', {
        name: NAMES[program],
        host
      })
    : hostProgramFailureText(failure, program, host)
}

/** What the confirm step says Reinstall will install and what it may then remove. */
export function hostProgramReinstallText(
  program: MarketplaceHostProgramId,
  host: string,
  command: string | undefined
): string {
  const name = NAMES[program]
  const run = command
    ? ` ${translate(`${COPY}.confirmRuns`, 'MassOrca will run: {{command}}', { command })}`
    : ''
  return `${translate(
    `${COPY}.reinstallConfirm`,
    'This installs {{name}} on {{host}} the way MassOrca manages it. The old copy is removed only when it sits in the vendor installer folder; any other copy stays where it is.',
    { name, host }
  )}${run}`
}
