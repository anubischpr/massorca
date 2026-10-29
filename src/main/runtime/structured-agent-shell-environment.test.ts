import { describe, expect, it } from 'vitest'
import {
  createStructuredAgentEnvironmentResolvers,
  structuredAgentBaseEnvironment
} from './structured-agent-shell-environment'

const INHERIT_ALL = { inheritAll: true, names: [] }

const shellEnv = {
  PATH: '/shell/bin',
  LANG: 'en_US.UTF-8',
  SSH_AUTH_SOCK: '/tmp/agent.sock',
  CODEX_LB_API_KEY: 'lb-key',
  ANTHROPIC_API_KEY: 'shell-key',
  CLAUDE_CONFIG_DIR: '/shell/claude',
  UNSET: undefined
}

const processEnv = { PATH: '/orca/bin', HOME: '/home/me', ORCA_USER_DATA_PATH: '/orca' }

describe('structuredAgentBaseEnvironment', () => {
  it('is the shell snapshot with the process PATH entries it lacks, when inheriting all', () => {
    expect(
      structuredAgentBaseEnvironment({
        shellEnv,
        policy: INHERIT_ALL,
        processEnv,
        platform: 'darwin'
      })
    ).toEqual({
      PATH: '/shell/bin:/orca/bin',
      LANG: 'en_US.UTF-8',
      SSH_AUTH_SOCK: '/tmp/agent.sock',
      CODEX_LB_API_KEY: 'lb-key',
      ANTHROPIC_API_KEY: 'shell-key',
      CLAUDE_CONFIG_DIR: '/shell/claude'
    })
  })

  it('keeps shims from the process PATH after the login PATH, without duplicates', () => {
    for (const policy of [INHERIT_ALL, { inheritAll: false, names: [] }]) {
      const env = structuredAgentBaseEnvironment({
        shellEnv: { PATH: '/usr/bin:/shell/bin' },
        policy,
        processEnv: { PATH: '/home/u/.local/share/mise/shims:/usr/bin:/orca/bin' },
        platform: 'linux'
      })
      expect(env.PATH).toBe('/usr/bin:/shell/bin:/home/u/.local/share/mise/shims:/orca/bin')
    }
  })

  it('carries tool-manager variables the login shell lacks, never over ones it sets', () => {
    const env = structuredAgentBaseEnvironment({
      shellEnv: { PATH: '/shell/bin', MISE_CONFIG_DIR: '/shell/mise-config' },
      policy: INHERIT_ALL,
      processEnv: {
        PATH: '/orca/bin',
        MISE_DATA_DIR: '/home/u/.local/share/mise',
        MISE_CONFIG_DIR: '/process/mise-config',
        VOLTA_HOME: '/home/u/.volta',
        UNRELATED: 'x'
      },
      platform: 'linux'
    })
    expect(env).toMatchObject({
      MISE_DATA_DIR: '/home/u/.local/share/mise',
      MISE_CONFIG_DIR: '/shell/mise-config',
      VOLTA_HOME: '/home/u/.volta'
    })
    expect(env).not.toHaveProperty('UNRELATED')
  })

  it('passes only the baseline and listed shell names over Orca env when off', () => {
    expect(
      structuredAgentBaseEnvironment({
        shellEnv,
        policy: { inheritAll: false, names: ['CODEX_LB_API_KEY'] },
        processEnv,
        platform: 'darwin'
      })
    ).toEqual({
      PATH: '/shell/bin:/orca/bin',
      HOME: '/home/me',
      ORCA_USER_DATA_PATH: '/orca',
      LANG: 'en_US.UTF-8',
      SSH_AUTH_SOCK: '/tmp/agent.sock',
      CODEX_LB_API_KEY: 'lb-key'
    })
  })

  it('matches names case-insensitively on Windows without duplicating Path', () => {
    expect(
      structuredAgentBaseEnvironment({
        shellEnv: { PATH: 'C:\\shell', codex_lb_api_key: 'lb-key' },
        policy: { inheritAll: false, names: ['CODEX_LB_API_KEY'] },
        processEnv: { Path: 'C:\\orca', USERPROFILE: 'C:\\Users\\me' },
        platform: 'win32'
      })
    ).toEqual({
      PATH: 'C:\\shell;C:\\orca',
      USERPROFILE: 'C:\\Users\\me',
      codex_lb_api_key: 'lb-key'
    })
  })
})

describe('createStructuredAgentEnvironmentResolvers', () => {
  it('gives Codex and Claude the same base, with overlays on Codex only', async () => {
    const resolvers = createStructuredAgentEnvironmentResolvers({
      resolveEnvironment: async () => ({ PATH: '/shell/bin', SHELL_ONLY: '1' }),
      resolveShellEnvironmentPolicy: () => INHERIT_ALL,
      processEnv: { PATH: '/shell/bin' },
      resolveCodexOverrides: () => ({ CODEX_PROFILE: 'p' })
    })
    expect(await resolvers.resolveClaudeInheritedEnv()).toEqual({
      PATH: '/shell/bin',
      SHELL_ONLY: '1'
    })
    expect(await resolvers.resolveCodexEnvironment()).toEqual({
      PATH: '/shell/bin',
      SHELL_ONLY: '1',
      CODEX_PROFILE: 'p'
    })
  })
})
