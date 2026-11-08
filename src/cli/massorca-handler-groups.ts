import type { HandlerGroup } from './handler-group-manifest'
import { BOT_TEAMS_COMMAND_KEYS } from './bot-teams-command-keys'

// Why split out: MassOrca's own feature commands change as a unit, apart from the upstream groups.
export const MASSORCA_HANDLER_GROUPS: readonly HandlerGroup[] = [
  {
    name: 'marketplace',
    keys: [
      'marketplace list',
      'marketplace connect',
      'marketplace disconnect',
      'marketplace access',
      'marketplace audit'
    ],
    load: async () => (await import('./handlers/marketplace.js')).MARKETPLACE_HANDLERS
  },
  {
    name: 'marketplace-services',
    keys: [
      'marketplace services list',
      'marketplace services connect',
      'marketplace services disconnect',
      'marketplace skills list',
      'marketplace skills show',
      'marketplace skills install',
      'marketplace skills agents',
      'marketplace skills uninstall'
    ],
    load: async () =>
      (await import('./handlers/marketplace-services.js')).MARKETPLACE_SERVICE_HANDLERS
  },
  {
    name: 'bot-teams',
    keys: BOT_TEAMS_COMMAND_KEYS,
    load: async () => (await import('./handlers/bot-teams.js')).BOT_TEAMS_HANDLERS
  },
  {
    name: 'prototypes',
    keys: [
      'prototypes list',
      'prototypes create',
      'prototypes archive',
      'prototypes unarchive',
      'prototypes rm',
      'prototypes restore-version',
      'prototypes write-attachment',
      'prototypes read-file',
      'prototypes design-system read',
      'prototypes design-system versions',
      'prototypes design-system version',
      'prototypes design-system restore'
    ],
    load: async () => (await import('./handlers/prototypes.js')).PROTOTYPES_HANDLERS
  },
  {
    name: 'jev',
    keys: ['jev status', 'jev enable', 'jev disable', 'jev set-key', 'jev clear-key'],
    load: async () => (await import('./handlers/jev.js')).JEV_HANDLERS
  },
  {
    name: 'account-usage',
    keys: ['account usage'],
    load: async () => (await import('./handlers/account-usage.js')).ACCOUNT_USAGE_HANDLERS
  },
  {
    name: 'folder-workspace',
    keys: [
      'folder-workspace list',
      'folder-workspace create',
      'folder-workspace update',
      'folder-workspace rm',
      'folder-workspace path-status'
    ],
    load: async () => (await import('./handlers/folder-workspace.js')).FOLDER_WORKSPACE_HANDLERS
  }
]
