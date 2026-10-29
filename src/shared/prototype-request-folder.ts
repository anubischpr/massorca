// The folder that holds one prototype request's directions, and the file names inside it. Paths
// are relative to the chat's visuals folder.

export const PROTOTYPE_FOLDER = 'prototypes'
export const PROTOTYPE_MANIFEST_FILE_NAME = 'request.json'
export const PROTOTYPE_DIRECTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const ID_SUFFIX_LENGTH = 6
const FILE_NAME_PATTERN = /^([A-Z])(?:-v([1-9][0-9]*))?\.html$/u

export type PrototypeFileName = {
  letter: string
  version: number
}

/** `<UTC date>-<UTC time>-<random suffix>`, such as `20261028-201500-k3f9q2`. */
export function createPrototypeRequestId(now: Date, random: () => number): string {
  if (!Number.isFinite(now.getTime())) {
    throw new RangeError('A prototype request needs a valid time')
  }
  const suffix = Array.from({ length: ID_SUFFIX_LENGTH }, () =>
    ID_ALPHABET.charAt(alphabetIndex(random()))
  )
  return `${utcStamp(now)}-${suffix.join('')}`
}

/** The request folder, relative to the chat's visuals folder. */
export function prototypeRequestFolder(requestId: string): string {
  return `${PROTOTYPE_FOLDER}/${requestId}`
}

/** True for a relative path under `prototypes/`; `/` and `\` both separate its segments. */
export function isPrototypePath(relativePath: string): boolean {
  const [folder = '', ...segments] = relativePath.replaceAll('\\', '/').split('/')
  return folder === PROTOTYPE_FOLDER && segments.length > 0 && segments.every(isPlainPathSegment)
}

/** A name in a path: not empty, not `.` or `..`, and without a separator. */
export function isPlainPathSegment(segment: string): boolean {
  return segment.length > 0 && segment !== '.' && segment !== '..' && !/[\\/]/u.test(segment)
}

/** A relative file path whose segments are all plain, such as `screens/home.html`. */
export function isRelativeFilePath(relativePath: string): boolean {
  return relativePath.split('/').every(isPlainPathSegment)
}

/** The letter of a direction from its zero-based index: 0 is `A`. */
export function directionLetter(index: number): string {
  return PROTOTYPE_DIRECTION_LETTERS.charAt(index)
}

/** `A.html` for version 1, `B-v2.html` for a later version. */
export function prototypeFileName(letter: string, version: number): string {
  return version === 1 ? `${letter}.html` : `${letter}-v${version}.html`
}

/** Reads `A.html` or `B-v2.html`; any other name, including `B-v1.html`, gives null. */
export function parsePrototypeFileName(fileName: string): PrototypeFileName | null {
  const match = FILE_NAME_PATTERN.exec(fileName)
  const letter = match?.[1]
  if (letter === undefined) {
    return null
  }
  const suffix = match?.[2]
  if (suffix === undefined) {
    return { letter, version: 1 }
  }
  const version = Number(suffix)
  return Number.isSafeInteger(version) && version >= 2 ? { letter, version } : null
}

const pad = (value: number, width = 2): string => String(value).padStart(width, '0')

function alphabetIndex(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(ID_ALPHABET.length - 1, Math.max(0, Math.floor(value * ID_ALPHABET.length)))
}

function utcStamp(now: Date): string {
  const date = `${pad(now.getUTCFullYear(), 4)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  return `${date}-${time}`
}
