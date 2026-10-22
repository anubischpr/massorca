import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { PRODUCT_DISPLAY_NAME } from '../../shared/product-identity'
import { getDevInstanceIdentity } from './dev-instance-identity'

// Why: the packaged build config is CommonJS and the only source for artifact, executable and
// installer identity, so the contract test reads it directly instead of duplicating its values.
const require = createRequire(import.meta.url)
const builderConfig = require('../../../config/electron-builder.config.cjs') as {
  appId: string
  productName: string
  protocols: { name: string; schemes: string[] }[]
  win: { executableName: string }
  mac: { executableName: string; extendInfo: Record<string, string> }
  linux: { executableName: string }
  deb: { packageName: string }
  rpm: { packageName: string }
  nsis: { artifactName: string }
}

describe('desktop identity contract', () => {
  it('shows MassOrca to people while keeping the install identity', () => {
    expect(PRODUCT_DISPLAY_NAME).toBe('MassOrca')
    expect(builderConfig.productName).toBe('MassOrca')
    expect(builderConfig.protocols).toEqual([{ name: 'MassOrca', schemes: ['orca'] }])
    // Why: electron-builder derives the NSIS registry key and upgrade identity from appId.
    expect(builderConfig.appId).toBe('com.stablyai.orca')
  })

  it('keeps the executable and CLI names that installs, shortcuts and the VPS service rely on', () => {
    expect(builderConfig.win.executableName).toBe('Orca')
    expect(builderConfig.mac.executableName).toBe('Orca')
    expect(builderConfig.linux.executableName).toBe('orca-ide')
    expect(builderConfig.deb.packageName).toBe('orca-ide')
    expect(builderConfig.rpm.packageName).toBe('orca-ide')
    expect(builderConfig.nsis.artifactName).toBe('orca-windows-setup.${ext}')
  })

  it('keeps the macOS Keychain name tied to CFBundleName=Orca', () => {
    expect(builderConfig.mac.extendInfo.CFBundleName).toBe('Orca')
    expect(builderConfig.mac.extendInfo.CFBundleDisplayName).toBe(PRODUCT_DISPLAY_NAME)
  })

  it('keeps Electron runtime name Orca while the display identity is MassOrca', () => {
    expect(getDevInstanceIdentity(false, {})).toMatchObject({
      name: PRODUCT_DISPLAY_NAME,
      appName: 'Orca'
    })
  })
})
