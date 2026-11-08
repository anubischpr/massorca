import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))

const { isWindowsDesktopClient, marketplaceWslTargetsFor } = await import('./marketplace-host-wsl')

const WINDOWS_APP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/38.0.0'
const MAC_APP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Electron/38.0.0'
const LINUX_APP = 'Mozilla/5.0 (X11; Linux x86_64) Electron/38.0.0'

describe('WSL distros as Marketplace hosts', () => {
  it('counts only the Windows desktop app as a client that lists WSL distros', () => {
    expect(isWindowsDesktopClient({ userAgent: WINDOWS_APP, webClient: false })).toBe(true)
    expect(isWindowsDesktopClient({ userAgent: WINDOWS_APP, webClient: true })).toBe(false)
    expect(isWindowsDesktopClient({ userAgent: MAC_APP, webClient: false })).toBe(false)
    expect(isWindowsDesktopClient({ userAgent: LINUX_APP, webClient: false })).toBe(false)
  })

  it('lists each distro as WSL: <distro> on Windows, and no WSL host elsewhere', () => {
    expect(marketplaceWslTargetsFor(true, ['Ubuntu', 'archlinux'])).toEqual([
      { kind: 'wsl', distro: 'Ubuntu', label: 'WSL: Ubuntu' },
      { kind: 'wsl', distro: 'archlinux', label: 'WSL: archlinux' }
    ])
    expect(marketplaceWslTargetsFor(false, ['Ubuntu'])).toEqual([])
  })
})
