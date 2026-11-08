import type { CommandHandler, HandlerContext } from '../dispatch'
import { getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import { marketplaceHostParam, resolveMarketplaceSkillHost } from '../marketplace-skill-host'
import { MARKETPLACE_PROGRAMS, type MarketplaceProgram } from '../marketplace-program-ids'
import { callMarketplaceHost } from './marketplace-host-call'

type ProgramAction = 'status' | 'install' | 'uninstall' | 'reinstall'

// Why: the host answers only when the installer finishes, up to ~25 min on a paired runtime.
const PROGRAM_TIMEOUT_MS = 26 * 60_000

type ProgramFailure = { ok: false; reason: string; message?: string; command?: string }
type ProgramActionResult = { ok: true; version?: string; message?: string } | ProgramFailure
export type ProgramStatus =
  | {
      ok: true
      installed: boolean
      version?: string
      path?: string
      method?: string
      installCommand?: string
      uninstallCommand?: string
      reinstallCommand?: string
      note?: string
      canInstall: boolean
      canUninstall: boolean
      canReinstall?: boolean
    }
  | ProgramFailure

function readProgram(ctx: HandlerContext): MarketplaceProgram {
  const raw = getRequiredStringFlag(ctx.flags, 'program')
  const program = MARKETPLACE_PROGRAMS.find((candidate) => candidate === raw)
  if (!program) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Unknown program "${raw}". Programs: ${MARKETPLACE_PROGRAMS.join(', ')}`
    )
  }
  return program
}

function formatFailure(program: string, action: ProgramAction, failure: ProgramFailure): string {
  const lines = [`${program}: could not ${action} (${failure.reason})`]
  if (failure.message) {
    lines.push(`  ${failure.message}`)
  }
  if (failure.command) {
    lines.push(`  Run this yourself: ${failure.command}`)
  }
  return lines.join('\n')
}

export function formatProgramStatus(program: string, status: ProgramStatus): string {
  if (!status.ok) {
    return formatFailure(program, 'status', status)
  }
  const head = status.installed
    ? `${program}: installed${status.version ? ` ${status.version}` : ''}${status.method ? ` via ${status.method}` : ''}`
    : `${program}: not installed`
  const can = [
    status.canInstall && 'install',
    status.canUninstall && 'uninstall',
    status.canReinstall && 'reinstall'
  ].filter(Boolean)
  const lines = [head]
  if (status.path) {
    lines.push(`  path: ${status.path}`)
  }
  lines.push(`  MassOrca can: ${can.join(', ') || 'nothing here'}`)
  for (const [label, command] of [
    ['install', status.installCommand],
    ['uninstall', status.uninstallCommand],
    ['reinstall', status.reinstallCommand]
  ]) {
    if (command) {
      lines.push(`  ${label} command: ${command}`)
    }
  }
  if (status.note) {
    lines.push(`  note: ${status.note}`)
  }
  return lines.join('\n')
}

function formatAction(program: string, action: ProgramAction, result: ProgramActionResult): string {
  if (!result.ok) {
    return formatFailure(program, action, result)
  }
  const done = `${program}: ${action} done${result.version ? ` (${result.version})` : ''}`
  return result.message ? `${done}\n  ${result.message}` : done
}

const CONFIRM: Partial<Record<ProgramAction, string>> = {
  uninstall: 'removes it from that host',
  reinstall: 'removes it and installs it again on that host'
}

async function callProgram<TResult extends { ok: boolean }>(
  ctx: HandlerContext,
  action: ProgramAction,
  program: MarketplaceProgram
) {
  const host = marketplaceHostParam(await resolveMarketplaceSkillHost(ctx.flags, ctx.client))
  const response = await callMarketplaceHost<TResult>(
    ctx,
    `marketplace.program.${action}`,
    { program, ...(host ? { host } : {}) },
    { timeoutMs: PROGRAM_TIMEOUT_MS }
  )
  if (!response.result.ok) {
    process.exitCode = 1
  }
  return response
}

function programHandler(action: Exclude<ProgramAction, 'status'>): CommandHandler {
  return async (ctx) => {
    const program = readProgram(ctx)
    const warning = CONFIRM[action]
    // Why: --json callers are scripts that already chose the action; a person at a prompt confirms.
    if (warning && !ctx.json && ctx.flags.get('yes') !== true) {
      throw new RuntimeClientError(
        'confirmation_required',
        `${action} ${program} ${warning}. Re-run with --yes to confirm.`
      )
    }
    const response = await callProgram<ProgramActionResult>(ctx, action, program)
    printResult(response, ctx.json, (value) => formatAction(program, action, value))
  }
}

export const MARKETPLACE_PROGRAM_HANDLERS: Record<string, CommandHandler> = {
  'marketplace program status': async (ctx) => {
    const program = readProgram(ctx)
    const response = await callProgram<ProgramStatus>(ctx, 'status', program)
    printResult(response, ctx.json, (value) => formatProgramStatus(program, value))
  },
  'marketplace program install': programHandler('install'),
  'marketplace program uninstall': programHandler('uninstall'),
  'marketplace program reinstall': programHandler('reinstall')
}
