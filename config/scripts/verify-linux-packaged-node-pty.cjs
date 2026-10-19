const { closeSync, existsSync, openSync, readSync } = require('node:fs')
const { createRequire } = require('node:module')
const { basename, dirname, isAbsolute, join, relative, sep } = require('node:path')

const TAG = '[verify-linux-packaged-node-pty]'
// node-pty ships no Linux prebuild, so build/Release is the only layout a Linux package carries.
const LINUX_ADDON_SEGMENTS = ['build', 'Release', 'pty.node']
const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46])

function isElfObject(filePath) {
  const fd = openSync(filePath, 'r')
  try {
    const header = Buffer.alloc(ELF_MAGIC.length)
    return readSync(fd, header, 0, header.length, 0) === header.length && header.equals(ELF_MAGIC)
  } finally {
    closeSync(fd)
  }
}

// require.resolve returns node-pty's entry file (lib/index.js), so walk up to the package root.
function nodePtyPackageDir(entryPath) {
  for (let dir = dirname(entryPath); ; dir = dirname(dir)) {
    if (basename(dir) === 'node-pty' && basename(dirname(dir)) === 'node_modules') {
      return dir
    }
    if (dirname(dir) === dir) {
      return null
    }
  }
}

/**
 * The packaged Linux daemon must resolve a node-pty that carries its own addon.
 *
 * electron-builder unpacks a whole package once one of its files is a .node or .so binary, so
 * a node-pty copy can land in app.asar.unpacked without its Linux addon. The daemon runs from
 * app.asar.unpacked, where Node finds that copy before resources/node_modules, and then fails
 * with "Failed to load native module: pty.node". Filesystem reads only: the addon is never
 * required, because a cross-built slice cannot execute on the packaging host.
 */
function verifyLinuxPackagedNodePty(resourcesDir) {
  const unpackedDir = join(resourcesDir, 'app.asar.unpacked')
  const unpackedNodePty = join(unpackedDir, 'node_modules', 'node-pty')
  if (existsSync(unpackedNodePty) && !existsSync(join(unpackedNodePty, ...LINUX_ADDON_SEGMENTS))) {
    throw new Error(
      `${TAG} ${unpackedNodePty} has no ${LINUX_ADDON_SEGMENTS.join('/')}. The packaged daemon ` +
        'resolves node-pty there before resources/node_modules and fails with "Failed to load ' +
        'native module: pty.node". Keep node-pty out of app.asar on Linux (linux.files in ' +
        'config/electron-builder.config.cjs).'
    )
  }

  // Why createRequire from the daemon: it is forked from app.asar.unpacked/out/main, so its bare
  // require('node-pty') walks that directory's node_modules chain.
  const daemonEntry = join(unpackedDir, 'out', 'main', 'daemon-entry.js')
  let resolved
  try {
    resolved = createRequire(daemonEntry).resolve('node-pty')
  } catch (error) {
    throw new Error(`${TAG} node-pty cannot be resolved from the packaged daemon: ${error.message}`)
  }
  const relativeToResources = relative(resourcesDir, resolved)
  if (
    isAbsolute(relativeToResources) ||
    relativeToResources === '..' ||
    relativeToResources.startsWith(`..${sep}`)
  ) {
    throw new Error(
      `${TAG} node-pty resolves to ${resolved}, outside ${resourcesDir}, so the packaged daemon ` +
        'would load a copy from the build host.'
    )
  }
  const packageDir = nodePtyPackageDir(resolved)
  if (packageDir === null) {
    throw new Error(`${TAG} cannot locate the node-pty package root for ${resolved}`)
  }
  const addon = join(packageDir, ...LINUX_ADDON_SEGMENTS)
  if (!existsSync(addon)) {
    throw new Error(
      `${TAG} node-pty resolves to ${packageDir}, which has no ` +
        `${LINUX_ADDON_SEGMENTS.join('/')}, so the packaged daemon cannot load its native module.`
    )
  }
  if (!isElfObject(addon)) {
    throw new Error(`${TAG} ${addon} is not an ELF object, so the Linux app cannot load it.`)
  }
  console.log(`${TAG} OK — the packaged daemon resolves node-pty to ${packageDir} with its addon`)
}

module.exports = {
  verifyLinuxPackagedNodePty
}
