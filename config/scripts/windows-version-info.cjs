// Why this exists: Task Manager names a process group after the exe's version-info
// FileDescription, and app-builder-lib hardcodes it (and ProductName) to productName,
// which stays 'Orca' because it is the install identity. There is no config option.
//
// Why inside the sign hook: winPackager.signAndEditResources writes the version strings
// and then calls signIf on the same file, so the hook is the first moment after that
// write and before any signature. afterPack runs too early (overwritten), afterSign too
// late (would break a signature). SignPath signs these bytes later in CI.
const { readFileSync, writeFileSync, existsSync } = require('node:fs')
const { createRequire } = require('node:module')
const { basename, dirname, join } = require('node:path')

const WINDOWS_DISPLAY_VERSION_KEYS = ['FileDescription', 'ProductName']

function loadResedit() {
  const builderRequire = createRequire(require.resolve('electron-builder/package.json'))
  const appBuilderRequire = createRequire(builderRequire.resolve('app-builder-lib/package.json'))
  return appBuilderRequire('resedit')
}

/** The packaged app exe sits next to its `resources` folder; bin\orca.exe and installers do not. */
function isPackagedAppExecutable(filePath, executableName) {
  if (typeof filePath !== 'string' || basename(filePath) !== `${executableName}.exe`) {
    return false
  }
  return existsSync(join(dirname(filePath), 'resources'))
}

/**
 * Sets the display version strings and returns whether the file changed. A no-op when
 * they already match, so the hook's second call (one per signing hash) and an already
 * signed exe keep their bytes.
 */
function setWindowsDisplayVersionStrings(filePath, displayName, resedit = loadResedit()) {
  const executable = resedit.NtExecutable.from(readFileSync(filePath))
  const resource = resedit.NtExecutableResource.from(executable)
  const [versionInfo] = resedit.Resource.VersionInfo.fromEntries(resource.entries)
  if (!versionInfo) {
    throw new Error(`[win-version-info] ${filePath} has no version resource`)
  }
  const languages = versionInfo.getAllLanguagesForStringValues()
  const stale = languages.filter((lang) => {
    const values = versionInfo.getStringValues(lang)
    return WINDOWS_DISPLAY_VERSION_KEYS.some((key) => values[key] !== displayName)
  })
  if (stale.length === 0) {
    return false
  }
  const strings = Object.fromEntries(WINDOWS_DISPLAY_VERSION_KEYS.map((key) => [key, displayName]))
  for (const lang of stale) {
    versionInfo.setStringValues(lang, strings)
  }
  versionInfo.outputToResourceEntries(resource.entries)
  resource.outputResource(executable)
  writeFileSync(filePath, Buffer.from(executable.generate()))
  return true
}

/** Wraps a `win.signtoolOptions.sign` hook so the app exe carries the display name first. */
function withWindowsDisplayVersionInfo(sign, { executableName, displayName }) {
  return (configuration, packager) => {
    const filePath = configuration?.path
    if (isPackagedAppExecutable(filePath, executableName)) {
      if (setWindowsDisplayVersionStrings(filePath, displayName)) {
        console.log(
          `[win-version-info] set ${WINDOWS_DISPLAY_VERSION_KEYS.join(', ')} to ${displayName}`
        )
      }
    }
    return sign(configuration, packager)
  }
}

module.exports = {
  WINDOWS_DISPLAY_VERSION_KEYS,
  isPackagedAppExecutable,
  setWindowsDisplayVersionStrings,
  withWindowsDisplayVersionInfo
}
