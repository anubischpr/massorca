import { beforeEach, describe, expect, it, vi } from 'vitest'
import { permitsAutomaticUpdates, readDistributionUpdatePolicy } from './distribution-policy'

const mocks = vi.hoisted(() => ({
  app: { isPackaged: true, getAppPath: vi.fn(() => '/packaged-orca') },
  readFileSync: vi.fn(() => '{}')
}))
vi.mock('electron', () => ({ app: mocks.app }))
vi.mock('node:fs', () => ({ readFileSync: mocks.readFileSync }))

describe('packaged distribution update policy', () => {
  beforeEach(() => {
    mocks.app.isPackaged = true
    mocks.readFileSync.mockReset().mockReturnValue('{}')
  })

  it('preserves unmarked official builds', () => {
    expect(permitsAutomaticUpdates({ version: '1.4.224' })).toBe(true)
    expect(readDistributionUpdatePolicy()).toBe(true)
  })

  it.each([
    { repository: 'anubischpr/orca', updatePolicy: 'manual' },
    null,
    { updatePolicy: 'unknown' },
    { updatePolicy: 'automatic' }
  ])('fails closed for a marked distribution: %j', (orcaDistribution) => {
    expect(permitsAutomaticUpdates({ orcaDistribution })).toBe(false)
  })

  it('reads the installed artifact rather than the source package or launcher environment', () => {
    mocks.readFileSync.mockReturnValue('{"orcaDistribution":{"updatePolicy":"manual"}}')
    expect(readDistributionUpdatePolicy()).toBe(false)
    expect(mocks.readFileSync).toHaveBeenCalledWith(expect.stringContaining('package.json'), 'utf8')
    expect(mocks.app.getAppPath).toHaveBeenCalled()
  })

  it('fails closed on unreadable or invalid packaged identity', () => {
    mocks.readFileSync.mockImplementation(() => {
      throw new Error('unreadable')
    })
    expect(readDistributionUpdatePolicy()).toBe(false)
    mocks.readFileSync.mockReturnValue('{')
    expect(readDistributionUpdatePolicy()).toBe(false)
  })

  it('does not change unpackaged development behavior', () => {
    mocks.app.isPackaged = false
    expect(readDistributionUpdatePolicy()).toBe(true)
    expect(mocks.readFileSync).not.toHaveBeenCalled()
  })
})
