import { resolve } from 'node:path'
import type { CommandHandler } from '../dispatch'
import { getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import type {
  DesignSystemVersionListed,
  ListDesignSystemVersionsResult,
  ReadDesignSystemVersionResult,
  ReadPrototypeDesignSystemResult,
  RestoreDesignSystemVersionResult
} from '../../shared/rpc-contract/prototype-params'
import {
  checkDesignSystemReadability,
  type PrototypeDesignSystemReadability
} from '../../shared/prototype-design-system-readability'
import { getRequiredVersionFlag, prototypeRefusal } from './prototypes-input'

function formatSystem(system: Extract<ReadPrototypeDesignSystemResult, { ok: true }>): string {
  const lines = [
    `Design system: ${system.projectName} (${system.projectKey})`,
    `Files: ${system.fileNames.length > 0 ? system.fileNames.join(', ') : 'none'}`
  ]
  if (system.unreadableFileNames && system.unreadableFileNames.length > 0) {
    lines.push(`Unreadable: ${system.unreadableFileNames.join(', ')}`)
  }
  lines.push('Use --json for the file contents.')
  return lines.join('\n')
}

/** The verdict of `design-system check`: readable or not, the folder, version and files read, then one line per reason. */
function formatReadability(verdict: PrototypeDesignSystemReadability): string {
  const lines = [verdict.readable ? 'readable' : 'not readable']
  if (verdict.folderPath !== undefined) {
    lines.push(`folder: ${verdict.folderPath}`)
  }
  if (verdict.version !== undefined) {
    lines.push(`version: ${verdict.version}`)
  }
  lines.push(`files read: ${verdict.filesRead.length > 0 ? verdict.filesRead.join(', ') : 'none'}`)
  lines.push(...verdict.reasons.map((reason) => `- ${reason}`))
  return lines.join('\n')
}

function formatVersion(version: DesignSystemVersionListed): string {
  return [
    `v${version.version}`,
    version.saved ? 'saved' : 'not saved',
    ...(version.current ? ['current'] : []),
    ...(version.at ? [version.at] : [])
  ].join('  ')
}

async function readSystem(
  ctx: Parameters<CommandHandler>[0],
  method: string,
  params: Record<string, unknown>,
  action: string
): Promise<void> {
  const response = await ctx.client.call<ReadDesignSystemVersionResult>(method, params)
  const reply = response.result
  if (!reply.ok) {
    throw prototypeRefusal(action, reply.error)
  }
  printResult(response, ctx.json, () => formatSystem(reply))
}

export const PROTOTYPES_DESIGN_SYSTEM_HANDLERS: Record<string, CommandHandler> = {
  'prototypes design-system read': (ctx) =>
    readSystem(
      ctx,
      'prototypes.readDesignSystem',
      { sessionId: getRequiredStringFlag(ctx.flags, 'session') },
      'Reading the design system'
    ),
  'prototypes design-system check': async ({ flags, client, json }) => {
    const project = flags.has('project') ? getRequiredStringFlag(flags, 'project') : undefined
    if (project !== undefined && flags.has('session')) {
      throw new RuntimeClientError('invalid_argument', 'Pass --session or --project, not both.')
    }
    const response = await client.call<ReadPrototypeDesignSystemResult>(
      'prototypes.readDesignSystem',
      project === undefined
        ? { sessionId: getRequiredStringFlag(flags, 'session') }
        : { projectPath: resolve(process.cwd(), project) }
    )
    const verdict = checkDesignSystemReadability(
      response.result,
      project === undefined ? 'chat' : 'project'
    )
    console.log(json ? JSON.stringify(verdict, null, 2) : formatReadability(verdict))
    // Why: a not-readable verdict exits 1, as `vm recipe doctor` does for a failing check.
    if (!verdict.readable) {
      process.exitCode = 1
    }
  },
  'prototypes design-system versions': async (ctx) => {
    const response = await ctx.client.call<ListDesignSystemVersionsResult>(
      'prototypes.listDesignSystemVersions',
      { sessionId: getRequiredStringFlag(ctx.flags, 'session') }
    )
    const reply = response.result
    if (!reply.ok) {
      throw prototypeRefusal('Listing the design system versions', reply.error)
    }
    printResult(response, ctx.json, () =>
      reply.versions.length === 0
        ? 'No saved design system versions.'
        : reply.versions.map(formatVersion).join('\n')
    )
  },
  'prototypes design-system version': (ctx) =>
    readSystem(
      ctx,
      'prototypes.readDesignSystemVersion',
      {
        sessionId: getRequiredStringFlag(ctx.flags, 'session'),
        version: getRequiredVersionFlag(ctx.flags)
      },
      'Reading the design system version'
    ),
  'prototypes design-system restore': async (ctx) => {
    const version = getRequiredVersionFlag(ctx.flags)
    const response = await ctx.client.call<RestoreDesignSystemVersionResult>(
      'prototypes.restoreDesignSystemVersion',
      { sessionId: getRequiredStringFlag(ctx.flags, 'session'), version }
    )
    const reply = response.result
    if (!reply.ok) {
      throw prototypeRefusal('Restoring the design system version', reply.error)
    }
    printResult(
      response,
      ctx.json,
      () => `Restored design system version ${version} as version ${reply.version}.`
    )
  }
}
