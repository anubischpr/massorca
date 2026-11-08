import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CommandHandler, HandlerContext } from '../dispatch'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import { rejectRemoteSelectionFlags } from '../remote-selection-flag-rejection'
import {
  deleteActiveClaudeKeychainCredentialsStrict,
  readActiveClaudeKeychainCredentialsStrict,
  writeActiveClaudeKeychainCredentials
} from '../../main/claude-accounts/keychain'
import { ACCOUNT_IMPORT_RUNTIME_CAPABILITY } from '../../shared/protocol-version'
import type { RuntimeStatus } from '../../shared/runtime-types'
import type {
  ClaudeRateLimitAccountsState,
  CodexRateLimitAccountsState,
  ManagedDataAccountsState
} from '../../shared/managed-account-types'
import {
  type InteractiveLoginSession,
  withInteractiveLoginCleanup
} from './interactive-login-interruption'
import { getWslAccountTarget } from './account-wsl-location'
import { runAgentLoginInTerminal } from './account-login-terminal'
import { addDataAccount, listDataAccounts, mutateDataAccount } from './data-account-commands'
import { formatAccountsBlock, formatDataAccounts } from './account-list-format'
import {
  addAntigravityAccount,
  consumeCodexResetCredit,
  isProviderAccountAgent,
  listAntigravityAccounts,
  removeProviderAccount,
  selectProviderAccount
} from './account-provider-commands'

// Why: add returns just that provider's state; list returns the full snapshot.
type AccountsListSnapshot = {
  opencode?: ManagedDataAccountsState
  devin?: ManagedDataAccountsState
  claude: ClaudeRateLimitAccountsState
  codex: CodexRateLimitAccountsState
}

async function cleanupClaudeLoginArtifacts(
  configDir: string,
  legacyCredentials: string | null,
  restoreLegacyCredentials: boolean
): Promise<void> {
  const errors: unknown[] = []
  if (process.platform === 'darwin') {
    try {
      await deleteActiveClaudeKeychainCredentialsStrict(configDir)
    } catch (error) {
      errors.push(error)
    }
    if (restoreLegacyCredentials) {
      try {
        await (legacyCredentials
          ? writeActiveClaudeKeychainCredentials(legacyCredentials)
          : deleteActiveClaudeKeychainCredentialsStrict())
      } catch (error) {
        errors.push(error)
      }
    }
  }
  try {
    rmSync(configDir, { recursive: true, force: true })
  } catch (error) {
    errors.push(error)
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, 'Failed to clean up Claude login artifacts.')
  }
}

/** Logs into a Claude account in a temp config dir, then registers it with the local runtime. */
async function addClaudeAccount({ client, cwd, json }: HandlerContext): Promise<void> {
  const configDir = mkdtempSync(join(tmpdir(), 'orca-account-add-claude-'))
  const session: InteractiveLoginSession = {
    child: null,
    registering: false,
    terminationPromise: null
  }
  let legacyCredentials: string | null = null
  let restoreLegacyCredentials = false
  const result = await withInteractiveLoginCleanup(
    session,
    async () => {
      await cleanupClaudeLoginArtifacts(configDir, legacyCredentials, restoreLegacyCredentials)
    },
    async () => {
      if (process.platform === 'darwin') {
        legacyCredentials = await readActiveClaudeKeychainCredentialsStrict()
        restoreLegacyCredentials = true
      }
      await runAgentLoginInTerminal(
        'claude',
        ['auth', 'login', '--claudeai'],
        {
          CLAUDE_CONFIG_DIR: configDir
        },
        json,
        session
      )
      session.registering = true
      return client.call<ClaudeRateLimitAccountsState>('accounts.addClaudeFromConfigDir', {
        configDir,
        ...getWslAccountTarget(cwd),
        ...(process.platform === 'darwin'
          ? {
              previousLegacyCredentialsSha256: legacyCredentials
                ? createHash('sha256').update(legacyCredentials).digest('hex')
                : null
            }
          : {})
      })
    }
  )
  printResult(result, json, (state) => formatAccountsBlock('Claude', state))
}

/** Logs into a Codex account in a temp CODEX_HOME, then registers it with the local runtime. */
async function addCodexAccount({ client, cwd, json }: HandlerContext): Promise<void> {
  const codexHome = mkdtempSync(join(tmpdir(), 'orca-account-add-codex-'))
  const session: InteractiveLoginSession = {
    child: null,
    registering: false,
    terminationPromise: null
  }
  const result = await withInteractiveLoginCleanup(
    session,
    async () => {
      rmSync(codexHome, { recursive: true, force: true })
    },
    async () => {
      // Why: plain OAuth binds a loopback callback the user's browser cannot reach
      // on a headless/SSH host; device auth is explicitly designed for this flow.
      await runAgentLoginInTerminal(
        'codex',
        ['login', '--device-auth'],
        { CODEX_HOME: codexHome },
        json,
        session
      )
      session.registering = true
      return client.call<CodexRateLimitAccountsState>('accounts.addCodexFromHome', {
        sourceHome: codexHome,
        ...getWslAccountTarget(cwd)
      })
    }
  )
  printResult(result, json, (state) => formatAccountsBlock('Codex', state))
}

/**
 * Rejects the runtime-selector flags instead of ignoring them. shouldIgnoreRemoteSelection
 * pins account commands to the local runtime, so honoring `--environment homelab`
 * silently would target the laptop rather than the host the user named — the exact
 * mistake this feature exists to avoid. A `--help` note does not reach someone who
 * already typed the flag.
 */
function rejectAccountRemoteSelectionFlags(ctx: HandlerContext, command: string): void {
  rejectRemoteSelectionFlags(
    ctx.flags,
    `\`${command}\`. Run it on the host whose accounts you want to manage.`
  )
}

async function assertAccountImportSupported({ client }: HandlerContext): Promise<void> {
  const status = await client.call<RuntimeStatus>('status.get')
  if (!status.result.capabilities?.includes(ACCOUNT_IMPORT_RUNTIME_CAPABILITY)) {
    throw new RuntimeClientError(
      'incompatible_runtime',
      'The running MassOrca runtime is too old to add accounts from the CLI. Update or restart MassOrca and try again.'
    )
  }
}

/** CLI handlers for managed account enrollment and listing. */
export const ACCOUNT_HANDLERS: Record<string, CommandHandler> = {
  'account add': async (ctx) => {
    const agentFlag = ctx.flags.get('agent')
    // Why: a valueless `--agent` parses as boolean true; defaulting it to claude
    // would silently run a full OAuth login for the provider the user did not ask for.
    if (agentFlag !== undefined && typeof agentFlag !== 'string') {
      throw new RuntimeClientError(
        'invalid_argument',
        'Missing a value for --agent. Use `--agent claude`, `--agent codex`, `--agent opencode`, or `--agent devin`.'
      )
    }
    const agent = agentFlag ?? 'claude'
    if (agent === 'antigravity') {
      rejectAccountRemoteSelectionFlags(ctx, 'orca account add')
      await addAntigravityAccount(ctx)
      return
    }
    if (agent !== 'claude' && agent !== 'codex' && agent !== 'opencode' && agent !== 'devin') {
      throw new RuntimeClientError(
        'invalid_argument',
        `Unsupported --agent "${agent}". Use "claude", "codex", "opencode", or "devin".`
      )
    }
    rejectAccountRemoteSelectionFlags(ctx, 'orca account add')
    if (agent === 'opencode' || agent === 'devin') {
      await addDataAccount(ctx, agent, runAgentLoginInTerminal)
      return
    }
    // Why: fail on runtime version skew before burning a full OAuth round trip.
    await assertAccountImportSupported(ctx)
    await ctx.client.call('accounts.list', { refreshUsage: false })
    await (agent === 'claude' ? addClaudeAccount(ctx) : addCodexAccount(ctx))
  },
  'account list': async (ctx) => {
    rejectAccountRemoteSelectionFlags(ctx, 'orca account list')
    const provider = ctx.flags.get('agent')
    if (provider === 'antigravity') {
      await listAntigravityAccounts(ctx)
      return
    }
    if (provider !== undefined) {
      await listDataAccounts(ctx, provider)
      return
    }
    const { client, json } = ctx
    // Why: this command renders no usage numbers, so skip the forced provider
    // refresh — it is one serial network round-trip per managed account.
    const result = await client.call<AccountsListSnapshot>('accounts.list', {
      refreshUsage: false
    })
    printResult(result, json, (snapshot) =>
      [
        formatAccountsBlock('Claude', snapshot.claude),
        formatAccountsBlock('Codex', snapshot.codex),
        ...(snapshot.opencode ? [formatDataAccounts('OpenCode', snapshot.opencode)] : []),
        ...(snapshot.devin ? [formatDataAccounts('Devin', snapshot.devin)] : [])
      ].join('\n\n')
    )
  },
  'account select': async (ctx) => {
    rejectAccountRemoteSelectionFlags(ctx, 'orca account select')
    const agent = ctx.flags.get('agent')
    if (isProviderAccountAgent(agent)) {
      await selectProviderAccount(ctx, agent)
      return
    }
    await mutateDataAccount(ctx, 'select')
  },
  'account rm': async (ctx) => {
    rejectAccountRemoteSelectionFlags(ctx, 'orca account rm')
    const agent = ctx.flags.get('agent')
    if (isProviderAccountAgent(agent)) {
      await removeProviderAccount(ctx, agent)
      return
    }
    await mutateDataAccount(ctx, 'remove')
  },
  'account codex-reset-credit': consumeCodexResetCredit
}
