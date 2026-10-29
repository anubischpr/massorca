import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const {
  isPackagedAppExecutable,
  setWindowsDisplayVersionStrings,
  withWindowsDisplayVersionInfo
} = require('./windows-version-info.cjs')
const builderRequire = createRequire(require.resolve('electron-builder/package.json'))
const resedit = createRequire(builderRequire.resolve('app-builder-lib/package.json'))('resedit')

const EN_US = { lang: 0x0409, codepage: 1200 }

// Mirrors what app-builder-lib's editWindowsResources leaves behind for productName 'Orca'.
function writeAppExe(dir) {
  const executable = resedit.NtExecutable.createEmpty()
  const resource = resedit.NtExecutableResource.from(executable)
  const versionInfo = resedit.Resource.VersionInfo.createEmpty()
  versionInfo.setStringValues(EN_US, {
    FileDescription: 'Orca',
    ProductName: 'Orca',
    InternalName: 'Orca',
    CompanyName: 'Stably AI'
  })
  versionInfo.outputToResourceEntries(resource.entries)
  resource.outputResource(executable)
  const filePath = join(dir, 'Orca.exe')
  writeFileSync(filePath, Buffer.from(executable.generate()))
  mkdirSync(join(dir, 'resources'))
  return filePath
}

function readStrings(filePath) {
  const executable = resedit.NtExecutable.from(readFileSync(filePath))
  const resource = resedit.NtExecutableResource.from(executable)
  const [versionInfo] = resedit.Resource.VersionInfo.fromEntries(resource.entries)
  return versionInfo.getStringValues(EN_US)
}

const makeDir = () => mkdtempSync(join(tmpdir(), 'orca-win-version-info-'))

describe('setWindowsDisplayVersionStrings', () => {
  it('renames only the display strings', () => {
    const filePath = writeAppExe(makeDir())
    expect(setWindowsDisplayVersionStrings(filePath, 'MassOrca')).toBe(true)
    expect(readStrings(filePath)).toMatchObject({
      FileDescription: 'MassOrca',
      ProductName: 'MassOrca',
      InternalName: 'Orca',
      CompanyName: 'Stably AI'
    })
  })

  it('leaves an already renamed exe byte-identical', () => {
    const filePath = writeAppExe(makeDir())
    setWindowsDisplayVersionStrings(filePath, 'MassOrca')
    const before = readFileSync(filePath)
    expect(setWindowsDisplayVersionStrings(filePath, 'MassOrca')).toBe(false)
    expect(readFileSync(filePath).equals(before)).toBe(true)
  })
})

describe('isPackagedAppExecutable', () => {
  it('matches only the app exe beside its resources folder', () => {
    const dir = makeDir()
    const appExe = writeAppExe(dir)
    expect(isPackagedAppExecutable(appExe, 'Orca')).toBe(true)
    expect(isPackagedAppExecutable(join(dir, 'resources', 'bin', 'orca.exe'), 'Orca')).toBe(false)
    expect(isPackagedAppExecutable(join(makeDir(), 'Orca.exe'), 'Orca')).toBe(false)
    expect(isPackagedAppExecutable(join(dir, 'orca-windows-setup.exe'), 'Orca')).toBe(false)
    expect(isPackagedAppExecutable(undefined, 'Orca')).toBe(false)
  })
})

describe('withWindowsDisplayVersionInfo', () => {
  it('renames the app exe before delegating to the wrapped hook', () => {
    const filePath = writeAppExe(makeDir())
    const sign = vi.fn(() => readStrings(filePath).FileDescription)
    const hook = withWindowsDisplayVersionInfo(sign, {
      executableName: 'Orca',
      displayName: 'MassOrca'
    })
    const configuration = { path: filePath }
    expect(hook(configuration, 'packager')).toBe('MassOrca')
    expect(sign).toHaveBeenCalledWith(configuration, 'packager')
  })

  it('passes other files straight through', () => {
    const dir = makeDir()
    const other = join(dir, 'orca-windows-setup.__uninstaller.exe')
    writeFileSync(other, 'not a pe file')
    const sign = vi.fn()
    withWindowsDisplayVersionInfo(sign, { executableName: 'Orca', displayName: 'MassOrca' })({
      path: other
    })
    expect(sign).toHaveBeenCalledOnce()
    expect(readFileSync(other, 'utf8')).toBe('not a pe file')
  })
})
