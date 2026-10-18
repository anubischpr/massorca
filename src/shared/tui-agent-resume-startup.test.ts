import { describe, expect, it } from 'vitest'
import { getAgentResumeArgv } from './agent-session-resume'
import { buildAgentResumeStartupPlan } from './tui-agent-startup'
import { selectedPiRuntime } from './pi-runtime-selection'

const TRANSCRIPT = '/home/neil/.pi/agent/sessions/session-1.jsonl'
const PI_SESSION = {
  key: 'session_id' as const,
  id: 'session-1',
  transcriptPath: TRANSCRIPT
}

function piPlan(args: {
  piRuntime?: 'pi' | 'gentle-shell'
  cmdOverrides?: Record<string, string>
  platform?: NodeJS.Platform
}): string {
  const plan = buildAgentResumeStartupPlan({
    agent: 'pi',
    providerSession: PI_SESSION,
    cmdOverrides: args.cmdOverrides ?? {},
    platform: args.platform ?? 'linux',
    ...(args.piRuntime ? { piRuntime: args.piRuntime } : {})
  })
  if (!plan) {
    throw new Error('expected a pi resume plan')
  }
  return plan.launchCommand
}

describe('getAgentResumeArgv for pi', () => {
  it('resumes stock pi through the pi executable', () => {
    expect(getAgentResumeArgv('pi', PI_SESSION)).toEqual(['pi', '--session', TRANSCRIPT])
    expect(getAgentResumeArgv('pi', PI_SESSION, null, 'pi')).toEqual([
      'pi',
      '--session',
      TRANSCRIPT
    ])
  })

  it('resumes a Gentle Shell session with its pi args after the launcher separator', () => {
    expect(getAgentResumeArgv('pi', PI_SESSION, null, 'gentle-shell')).toEqual([
      'gentle-shell',
      '--',
      '--session',
      TRANSCRIPT
    ])
  })

  it('keeps a session without a transcript path unresumable for both runtimes', () => {
    const noTranscript = { key: 'session_id' as const, id: 'session-1' }
    expect(getAgentResumeArgv('pi', noTranscript, null, 'gentle-shell')).toBeNull()
  })
})

describe('buildAgentResumeStartupPlan for pi runtimes', () => {
  it('launches stock pi with its session argv by default', () => {
    expect(piPlan({})).toBe(`pi '--session' '${TRANSCRIPT}'`)
    expect(piPlan({ piRuntime: 'pi' })).toBe(`pi '--session' '${TRANSCRIPT}'`)
  })

  it('launches the default Gentle Shell command with its pi args after --', () => {
    expect(piPlan({ piRuntime: 'gentle-shell' })).toBe(
      `gentle-shell '--' '--session' '${TRANSCRIPT}'`
    )
  })

  it('identifies the resumed launch as Gentle Shell so its status extension installs there', () => {
    expect(selectedPiRuntime(piPlan({ piRuntime: 'gentle-shell' }))).toBe('gentle-shell')
    expect(selectedPiRuntime(piPlan({ piRuntime: 'pi' }))).toBe('pi')
  })

  it('launches a configured Gentle Shell command in place of the default', () => {
    expect(
      piPlan({
        piRuntime: 'gentle-shell',
        cmdOverrides: { pi: '/opt/gentle/bin/gentle-shell --verbose' }
      })
    ).toBe(`/opt/gentle/bin/gentle-shell --verbose '--' '--session' '${TRANSCRIPT}'`)
  })

  it('replaces a configured stock pi command when the chat runs Gentle Shell', () => {
    expect(piPlan({ piRuntime: 'gentle-shell', cmdOverrides: { pi: '/usr/bin/pi' } })).toBe(
      `gentle-shell '--' '--session' '${TRANSCRIPT}'`
    )
  })

  it('keeps a configured stock pi command for a stock pi chat', () => {
    expect(piPlan({ piRuntime: 'pi', cmdOverrides: { pi: '/usr/bin/pi' } })).toBe(
      `/usr/bin/pi '--session' '${TRANSCRIPT}'`
    )
  })

  it('drops a Gentle Shell override from a stock pi chat', () => {
    expect(piPlan({ piRuntime: 'pi', cmdOverrides: { pi: 'gentle-shell' } })).toBe(
      `pi '--session' '${TRANSCRIPT}'`
    )
  })

  it('quotes the Gentle Shell argv for a Windows host', () => {
    const command = piPlan({
      piRuntime: 'gentle-shell',
      cmdOverrides: { pi: 'C:/tools/gentle-shell.cmd' },
      platform: 'win32'
    })
    expect(command).toBe(`C:/tools/gentle-shell.cmd '--' '--session' '${TRANSCRIPT}'`)
  })

  it('ignores the Pi runtime for other agents', () => {
    const plan = buildAgentResumeStartupPlan({
      agent: 'codex',
      providerSession: { key: 'session_id', id: '0199aa11-2b3c-4d5e-8f90-a1b2c3d4e5f6' },
      cmdOverrides: {},
      platform: 'linux',
      piRuntime: 'gentle-shell'
    })
    expect(plan?.launchCommand).toBe("codex 'resume' '0199aa11-2b3c-4d5e-8f90-a1b2c3d4e5f6'")
  })
})
