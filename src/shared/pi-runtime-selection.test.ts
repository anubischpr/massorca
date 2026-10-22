import { describe, expect, it } from 'vitest'
import { piTerminalCommandOverrides } from './pi-runtime-selection'

describe('piTerminalCommandOverrides', () => {
  it('names gentle-shell when the host runs only Gentle Shell and the client names no Pi command', () => {
    expect(piTerminalCommandOverrides({}, 'gentle-shell')).toEqual({ pi: 'gentle-shell' })
  })

  it('leaves the stock command alone when the host runs stock pi', () => {
    expect(piTerminalCommandOverrides({}, 'pi')).toEqual({})
  })

  it('leaves the command alone when the host did not say', () => {
    expect(piTerminalCommandOverrides({}, 'unknown')).toEqual({})
  })

  it('leaves the command alone when no Pi runtime is installed, so the launch reports it', () => {
    expect(piTerminalCommandOverrides({}, 'cliMissing')).toEqual({})
  })

  it('keeps an explicit client Pi command even when the host runs only Gentle Shell', () => {
    expect(piTerminalCommandOverrides({ pi: '/opt/pi --flag' }, 'gentle-shell')).toEqual({
      pi: '/opt/pi --flag'
    })
  })

  it('treats a blank client Pi command as none', () => {
    expect(piTerminalCommandOverrides({ pi: '   ' }, 'gentle-shell')).toEqual({
      pi: 'gentle-shell'
    })
  })

  it('keeps the other agents command overrides', () => {
    expect(piTerminalCommandOverrides({ claude: 'claude-dev' }, 'gentle-shell')).toEqual({
      claude: 'claude-dev',
      pi: 'gentle-shell'
    })
  })
})
