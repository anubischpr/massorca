import { describe, expect, it, vi } from 'vitest'
import { ANTIGRAVITY_RUNTIME_REGISTRATION } from './runtime-registration'

const mocks = vi.hoisted(() => ({
  binding: vi.fn(async () => ({ kind: 'antigravity', locator: {} })),
  prepare: vi.fn(async () => {}),
  environment: { HOME: '/execution-host', PATH: '/host/bin', LANG: 'en_US.UTF-8' }
}))
vi.mock('./structured-account-binding', () => ({ readAntigravityAccountBinding: mocks.binding }))
vi.mock('./native-account-launch', () => ({ prepareAntigravityAccountForLaunch: mocks.prepare }))
vi.mock('../startup/login-shell-environment', () => ({
  resolveLoginShellEnvironment: async () => mocks.environment
}))

// The process PATH's own entries follow the login PATH.
const hostPathFirst = expect.stringMatching(/^\/host\/bin(?:[:;]|$)/)

describe('Antigravity account-home registration', () => {
  it.each(['read', 'launch'] as const)(
    'expands partial agent overrides before %s account binding',
    async (purpose) => {
      const unused = (): never => {
        throw new Error('unused')
      }
      await ANTIGRAVITY_RUNTIME_REGISTRATION.resolveAccountHome(
        {
          launchEnv: { LANG: 'C' },
          location: null,
          purpose,
          workspacePath: null
        },
        {
          getClaudeConfigDirectory: unused,
          prepareCodexLaunchHome: unused,
          readCodexLaunchHome: unused,
          workspaceTrustSettings: () => ({
            agentWorkspaceTrustEnabled: false,
            nativeChatInheritShellEnvironment: true
          })
        }
      )
      expect(mocks.binding).toHaveBeenLastCalledWith({
        launchEnv: expect.objectContaining({
          HOME: '/execution-host',
          PATH: hostPathFirst,
          LANG: 'C'
        })
      })
      if (purpose === 'launch') {
        expect(mocks.prepare).toHaveBeenLastCalledWith(
          expect.objectContaining({
            env: expect.objectContaining({
              HOME: '/execution-host',
              PATH: hostPathFirst,
              LANG: 'C'
            }),
            envIsComplete: true
          })
        )
      }
    }
  )
})
