import { describe, expect, it } from 'vitest'
import {
  PI_RUNTIME_HOME_DIR_NAME,
  isPiRuntimeSelection,
  piRuntimeCommandSettings,
  resolvePiSessionRuntime,
  selectedPiRuntime
} from '../../shared/pi-runtime-selection'
import {
  CreateSupportParams,
  CreateIntentParams
} from '../../shared/rpc-contract/structured-agent-session-params'
import { structuredAgentSessionCreateParams } from '../../shared/structured-agent-session-create'
import { structuredAgentSessionCreateIntentFingerprint } from '../runtime/rpc/methods/structured-agent-session-create'

describe('bounded Pi runtime selection', () => {
  it('carries Gentle Shell in the same client/host create fingerprint', () => {
    const params = structuredAgentSessionCreateParams({
      sessionId: 'pi_0123456789abcdef0123456789abcdef',
      worktree: 'id:workspace',
      agent: 'pi',
      piRuntime: 'gentle-shell',
      accessMode: 'full-access',
      randomUuid: () => '01234567-89ab-cdef-0123-456789abcdef'
    })
    expect(CreateIntentParams.safeParse(params).success).toBe(true)
    expect(structuredAgentSessionCreateIntentFingerprint(params)).toBe(
      params.envelope.payloadFingerprint
    )
    expect(structuredAgentSessionCreateIntentFingerprint({ ...params, piRuntime: 'pi' })).not.toBe(
      params.envelope.payloadFingerprint
    )
  })
  it('keeps old clients valid and rejects shell strings and choices on other providers', () => {
    expect(CreateSupportParams.parse({ worktree: 'id:workspace', agent: 'pi' })).not.toHaveProperty(
      'piRuntime'
    )
    expect(
      CreateSupportParams.safeParse({
        worktree: 'id:workspace',
        agent: 'pi',
        accessMode: 'inherit'
      }).success
    ).toBe(false)
    expect(
      CreateSupportParams.safeParse({
        worktree: 'id:workspace',
        agent: 'codex',
        accessMode: 'full-access'
      }).success
    ).toBe(false)
    for (const piRuntime of ['gentle-shell --unsafe', '/bin/bash', 'stock-pi', 7]) {
      expect(
        CreateSupportParams.safeParse({ worktree: 'id:workspace', agent: 'pi', piRuntime }).success
      ).toBe(false)
    }
    expect(
      CreateSupportParams.safeParse({
        worktree: 'id:workspace',
        agent: 'codex',
        piRuntime: 'gentle-shell'
      }).success
    ).toBe(false)
  })
  it('overrides only the per-session Pi command, leaving host settings untouched', () => {
    const host = { agentCmdOverrides: { pi: '/host/pi', codex: '/host/codex' } }
    expect(piRuntimeCommandSettings(host, 'gentle-shell').agentCmdOverrides).toEqual({
      pi: 'gentle-shell',
      codex: '/host/codex'
    })
    expect(host.agentCmdOverrides.pi).toBe('/host/pi')
    expect(piRuntimeCommandSettings(host, 'pi')).toBe(host)
    const gentleHost = { agentCmdOverrides: { pi: '/host/gentle-shell' } }
    expect(piRuntimeCommandSettings(gentleHost, 'gentle-shell')).toBe(gentleHost)
    expect(selectedPiRuntime('C:\\tools\\gentle-shell.cmd')).toBe('gentle-shell')
    expect(selectedPiRuntime(undefined)).toBe('pi')
    expect(isPiRuntimeSelection('gentle-shell')).toBe(true)
  })
  it('reads the launch binary of a TUI command that carries arguments', () => {
    expect(selectedPiRuntime('gentle-shell --model provider/model')).toBe('gentle-shell')
    expect(selectedPiRuntime('"C:\\Program Files\\Gentle\\gentle-shell.cmd" --resume')).toBe(
      'gentle-shell'
    )
    expect(selectedPiRuntime('pi --resume gentle-shell')).toBe('pi')
    expect(selectedPiRuntime('my-gentle-shell-wrapper')).toBe('pi')
    expect(PI_RUNTIME_HOME_DIR_NAME).toEqual({ pi: '.pi', 'gentle-shell': '.gentle-shell' })
  })
  it('resolves an existing chat from its session before the client Pi setting', () => {
    const gentle = '/home/u/.gentle-shell/agent/sessions/--w--/s.jsonl'
    const stock = '/home/u/.pi/agent/sessions/--w--/s.jsonl'
    expect(resolvePiSessionRuntime({ transcriptPath: gentle, command: 'pi' })).toBe('gentle-shell')
    expect(resolvePiSessionRuntime({ transcriptPath: stock, command: 'gentle-shell' })).toBe('pi')
    expect(resolvePiSessionRuntime({ hostRuntime: 'gentle-shell', transcriptPath: stock })).toBe(
      'gentle-shell'
    )
    expect(resolvePiSessionRuntime({ launchSeed: 'gentle-shell', transcriptPath: stock })).toBe(
      'gentle-shell'
    )
    expect(resolvePiSessionRuntime({ hostRuntime: 'nope', command: 'gentle-shell' })).toBe(
      'gentle-shell'
    )
    expect(resolvePiSessionRuntime({})).toBe('pi')
  })
})
