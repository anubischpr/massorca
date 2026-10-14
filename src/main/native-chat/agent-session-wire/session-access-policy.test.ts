import { describe, expect, it } from 'vitest'
import {
  resolveAgentSessionFullAccess,
  supportsAgentSessionAccessMode
} from '../../../shared/agent-session-access-mode'
import { codexStructuredPermissionPolicyForSession } from '../../codex/codex-structured-permission-policy'
import {
  narrowStructuredLaunchSeedOptions,
  resolveStructuredLaunchSeedOptions
} from '../../../shared/native-chat-session-option-defaults'
import { decodeAgentSessionAgentsResult } from '../../../shared/agent-session-registered-agents'
import { buildPiRpcLaunch } from '../../pi/rpc-launch'

describe('session access policy', () => {
  it.each([false, true])(
    'inherits the existing global posture %s without widening it',
    (global) => {
      expect(resolveAgentSessionFullAccess(undefined, global)).toBe(global)
      expect(resolveAgentSessionFullAccess('inherit', global)).toBe(global)
      expect(resolveAgentSessionFullAccess('default', global)).toBe(false)
      expect(resolveAgentSessionFullAccess('full-access', global)).toBe(true)
    }
  )

  it('keeps explicit Codex policies isolated from the inherited policy', () => {
    const inherited = { approvalPolicy: 'never', sandbox: 'danger-full-access' } as const
    expect(codexStructuredPermissionPolicyForSession('default', inherited)).toEqual({
      approvalPolicy: 'on-request',
      sandbox: 'workspace-write'
    })
    expect(codexStructuredPermissionPolicyForSession(undefined, inherited)).toBe(inherited)
    expect(codexStructuredPermissionPolicyForSession('full-access', inherited)).toEqual(inherited)
    expect(inherited).toEqual({ approvalPolicy: 'never', sandbox: 'danger-full-access' })
    expect(() => resolveAgentSessionFullAccess('invalid', true)).toThrow('access mode is invalid')
    expect(() => codexStructuredPermissionPolicyForSession('invalid', inherited)).toThrow(
      'access mode is invalid'
    )
  })

  it('seeds session access without adopting a global per-model access value', () => {
    const settings = {
      codex: {
        model: 'model-a',
        valuesByModel: { 'model-a': { accessMode: 'full-access', effort: 'high' } }
      }
    }
    expect(resolveStructuredLaunchSeedOptions(settings, 'codex')).toEqual({
      model: 'model-a',
      effort: 'high'
    })
    expect(narrowStructuredLaunchSeedOptions({ accessMode: 'default' })).toEqual({
      accessMode: 'default'
    })
    expect(narrowStructuredLaunchSeedOptions({ accessMode: 'invalid' })).toBeUndefined()
    expect(settings.codex.valuesByModel['model-a'].accessMode).toBe('full-access')
  })

  it('advertises access independently of models, with legacy agents unchanged', () => {
    const rows = decodeAgentSessionAgentsResult({
      agents: [
        { agent: 'agy', capabilities: { supportedAccessModes: ['default', 'full-access'] } },
        { agent: 'pi', capabilities: { supportedAccessModes: ['full-access'] } },
        { agent: 'opencode', capabilities: {} }
      ]
    })
    expect(rows?.[0].capabilities.supportedAccessModes).toEqual(['default', 'full-access'])
    expect(rows?.[2].capabilities.supportedAccessModes).toBeUndefined()
    expect(
      supportsAgentSessionAccessMode('default', rows?.[1].capabilities.supportedAccessModes)
    ).toBe(false)
    expect(supportsAgentSessionAccessMode('inherit', ['full-access'])).toBe(true)
  })

  it.each([undefined, 'inherit', 'default'])(
    'refuses restricted Pi and GentleShell launches: %s',
    (mode) => {
      for (const command of ['pi', 'gentle-shell']) {
        expect(() =>
          buildPiRpcLaunch({
            command,
            cwd: '/workspace',
            fullAccess: resolveAgentSessionFullAccess(mode, false)
          })
        ).toThrow('supports full access only')
      }
      expect(
        buildPiRpcLaunch({
          command: 'pi',
          cwd: '/workspace',
          fullAccess: resolveAgentSessionFullAccess('full-access', false)
        }).args
      ).toEqual(['--mode', 'rpc'])
    }
  )
})
