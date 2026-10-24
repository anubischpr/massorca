import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

import { ANDROID_INSTALL_GUIDE_URL, getInstallCopy } from './mobile-platform-copy'

const GUIDE =
  'https://github.com/anubischpr/massorca/blob/custom/integration/docs/readme/massorca-mobile.md'

describe('mobile install copy', () => {
  it('sends Android to the MassOrca mobile releases and guide', () => {
    expect(getInstallCopy('android', 'stable').url).toBe(
      'https://github.com/anubischpr/massorca/releases?q=mobile-android'
    )
    expect(ANDROID_INSTALL_GUIDE_URL).toBe(`${GUIDE}#android`)
  })

  it('never sends iOS to the upstream App Store or TestFlight listing', () => {
    for (const channel of ['stable', 'preview'] as const) {
      const copy = getInstallCopy('ios', channel)
      expect(copy.url).toBe(`${GUIDE}#ios`)
      expect(copy.url).not.toMatch(/apple\.com/)
    }
  })
})
