import { readFileSync, statSync, writeFileSync } from 'node:fs'

/** Why: the rolling backup is overwritten by every write, so this one copy keeps the user's first bytes. */
export function keepFirstOriginal(filePath: string): void {
  try {
    // Why: 'wx' fails when the copy exists, so a later write never replaces the first original.
    writeFileSync(`${filePath}.massorca-original`, readFileSync(filePath), {
      flag: 'wx',
      mode: statSync(filePath).mode
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
}
