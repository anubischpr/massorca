import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { verifyLinuxPackagedNodePty } = require('./verify-linux-packaged-node-pty.cjs')

// 0x7f 'E' 'L' 'F' plus class/data/version bytes: enough for the magic check.
const ELF_ADDON = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00])
// A Windows PE header: the addon a Windows build leaves behind must never pass as Linux.
const PE_ADDON = Buffer.from([0x4d, 0x5a, 0x90, 0x00])

async function writeNodePtyPackage(packageDir, addon) {
  await mkdir(join(packageDir, 'lib'), { recursive: true })
  await writeFile(
    join(packageDir, 'package.json'),
    JSON.stringify({ name: 'node-pty', version: '1.1.0', main: './lib/index.js' })
  )
  await writeFile(join(packageDir, 'lib', 'index.js'), 'module.exports = {}\n')
  if (addon !== undefined) {
    await mkdir(join(packageDir, 'build', 'Release'), { recursive: true })
    await writeFile(join(packageDir, 'build', 'Release', 'pty.node'), addon)
  }
}

describe('verifyLinuxPackagedNodePty', () => {
  let root
  let resourcesDir

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'orca-linux-node-pty-'))
    resourcesDir = join(root, 'resources')
    await mkdir(join(resourcesDir, 'app.asar.unpacked', 'out', 'main'), { recursive: true })
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('accepts a Linux package that keeps node-pty out of app.asar.unpacked', async () => {
    await writeNodePtyPackage(join(resourcesDir, 'node_modules', 'node-pty'), ELF_ADDON)

    expect(() => verifyLinuxPackagedNodePty(resourcesDir)).not.toThrow()
  })

  it('accepts an unpacked copy that carries its Linux addon', async () => {
    await writeNodePtyPackage(
      join(resourcesDir, 'app.asar.unpacked', 'node_modules', 'node-pty'),
      ELF_ADDON
    )

    expect(() => verifyLinuxPackagedNodePty(resourcesDir)).not.toThrow()
  })

  // Why: the shape that shipped in the Linux closure, where the daemon's first resolved copy has
  // lib/ but no build/Release, even though resources/node_modules holds a working addon.
  it('rejects an incomplete unpacked copy that would shadow the working addon', async () => {
    await writeNodePtyPackage(join(resourcesDir, 'node_modules', 'node-pty'), ELF_ADDON)
    await writeNodePtyPackage(join(resourcesDir, 'app.asar.unpacked', 'node_modules', 'node-pty'))

    expect(() => verifyLinuxPackagedNodePty(resourcesDir)).toThrow(
      /has no build\/Release\/pty\.node.*Keep node-pty out of app\.asar on Linux/
    )
  })

  it('rejects resolution that reaches a package without its addon', async () => {
    await writeNodePtyPackage(join(resourcesDir, 'node_modules', 'node-pty'))

    expect(() => verifyLinuxPackagedNodePty(resourcesDir)).toThrow(
      /resolves to .* which has no build\/Release\/pty\.node/
    )
  })

  it('rejects an addon that is not an ELF object', async () => {
    await writeNodePtyPackage(join(resourcesDir, 'node_modules', 'node-pty'), PE_ADDON)

    expect(() => verifyLinuxPackagedNodePty(resourcesDir)).toThrow(/is not an ELF object/)
  })

  // Why: a host-installed node-pty must never certify a packaged app that does not carry one.
  it('rejects node-pty resolved from outside the packaged resources', async () => {
    await writeNodePtyPackage(join(root, 'node_modules', 'node-pty'), ELF_ADDON)

    expect(() => verifyLinuxPackagedNodePty(resourcesDir)).toThrow(/outside .*resources/)
  })

  it('rejects a packaged app that cannot resolve node-pty at all', async () => {
    expect(() => verifyLinuxPackagedNodePty(resourcesDir)).toThrow(
      /node-pty cannot be resolved from the packaged daemon/
    )
  })
})
