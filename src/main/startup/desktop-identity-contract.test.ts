import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { PRODUCT_DISPLAY_NAME } from '../../shared/product-identity'
import { getDevInstanceIdentity } from './dev-instance-identity'

// Why: only the identity fields are required. Platform sections are optional because the builder
// config can omit them on some hosts, and each one is asserted only where it is present.
const builderConfigSchema = z.object({
  appId: z.string(),
  productName: z.string(),
  protocols: z.array(z.object({ name: z.string(), schemes: z.array(z.string()) })),
  win: z.object({ executableName: z.string().optional() }).optional(),
  mac: z
    .object({
      executableName: z.string().optional(),
      extendInfo: z.record(z.string(), z.unknown()).optional()
    })
    .optional(),
  linux: z
    .object({
      executableName: z.string().optional(),
      desktop: z.object({ entry: z.object({ Name: z.string().optional() }).optional() }).optional()
    })
    .optional(),
  deb: z.object({ packageName: z.string().optional() }).optional(),
  rpm: z.object({ packageName: z.string().optional() }).optional(),
  nsis: z
    .object({
      artifactName: z.string().optional(),
      shortcutName: z.string().optional(),
      uninstallDisplayName: z.string().optional()
    })
    .optional()
})

// Why: the packaged build config is CommonJS and the only source for artifact, executable and
// installer identity, so the contract test reads it directly instead of duplicating its values.
const require = createRequire(import.meta.url)
const builderConfig = builderConfigSchema.parse(
  require('../../../config/electron-builder.config.cjs')
)

function expectWhenPresent(actual: unknown, expected: unknown): void {
  if (actual !== undefined) {
    expect(actual).toBe(expected)
  }
}

describe('desktop identity contract', () => {
  it('keeps the install name Orca and the protocol and appId identity', () => {
    // Why: productName drives the Linux /opt install path and the Windows install folder.
    expect(builderConfig.productName).toBe('Orca')
    expect(builderConfig.protocols).toEqual([{ name: PRODUCT_DISPLAY_NAME, schemes: ['orca'] }])
    // Why: electron-builder derives the NSIS registry key and upgrade identity from appId.
    expect(builderConfig.appId).toBe('com.stablyai.orca')
  })

  it('shows MassOrca on the surfaces that carry the display name', () => {
    expectWhenPresent(builderConfig.nsis?.shortcutName, PRODUCT_DISPLAY_NAME)
    expectWhenPresent(builderConfig.nsis?.uninstallDisplayName, PRODUCT_DISPLAY_NAME)
    expectWhenPresent(builderConfig.linux?.desktop?.entry?.Name, PRODUCT_DISPLAY_NAME)
    expectWhenPresent(builderConfig.mac?.extendInfo?.CFBundleDisplayName, PRODUCT_DISPLAY_NAME)
  })

  it('keeps the executable and CLI names that installs, shortcuts and the VPS service rely on', () => {
    expectWhenPresent(builderConfig.win?.executableName, 'Orca')
    expectWhenPresent(builderConfig.mac?.executableName, 'Orca')
    expectWhenPresent(builderConfig.linux?.executableName, 'orca-ide')
    expectWhenPresent(builderConfig.deb?.packageName, 'orca-ide')
    expectWhenPresent(builderConfig.rpm?.packageName, 'orca-ide')
    expectWhenPresent(builderConfig.nsis?.artifactName, 'orca-windows-setup.${ext}')
  })

  it('keeps the macOS Keychain name tied to CFBundleName=Orca', () => {
    expectWhenPresent(builderConfig.mac?.extendInfo?.CFBundleName, 'Orca')
  })

  it('keeps Electron runtime name Orca while the display identity is MassOrca', () => {
    expect(getDevInstanceIdentity(false, {})).toMatchObject({
      name: PRODUCT_DISPLAY_NAME,
      appName: 'Orca'
    })
  })

  it('titles the renderer windows MassOrca', () => {
    for (const page of ['index.html', 'popout.html']) {
      const html = readFileSync(join(RENDERER_DIR, page), 'utf8')
      expect(html).toMatch(new RegExp(`<title>${PRODUCT_DISPLAY_NAME}\\b`))
    }
  })

  it('never shows the bare Orca brand in the English UI catalog', () => {
    const catalog: unknown = JSON.parse(
      readFileSync(join(RENDERER_DIR, 'src', 'i18n', 'locales', 'en.json'), 'utf8')
    )
    // Why: paths and file names such as /opt/Orca or Orca.app are identifiers, not branding.
    const bareBrand = /(?<![\w/.-])Orca\b(?![\\/]|\.[A-Za-z])/
    expect(collectStrings(catalog).filter((value) => bareBrand.test(value))).toEqual([])
  })
})

const RENDERER_DIR = join(import.meta.dirname, '..', '..', 'renderer')

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap(collectStrings)
  }
  return []
}
