// A file path: absolute (C:\, /, ~/) or relative with a folder, ending in a file name with a letter-led
// extension. A URL never matches: its slashes follow ":" or "/", which the lookbehind refuses.
const FILE_PATH =
  /(?<![\w./\\:~-])(?:[A-Za-z]:[\\/]|~\/|\/)?(?:[\w.@-]+[\\/])+[\w@-][\w.@-]*\.[A-Za-z][A-Za-z0-9]{0,7}(?![\w/\\])/g

/**
 * A bot's room line with every file path cut to its file name: the room attaches the file, so the
 * person reads the name, not where it sits on the host. The stored text is unchanged.
 */
export function botTeamRoomTextWithFileNames(text: string): string {
  return text.replace(FILE_PATH, (match) => match.split(/[\\/]/).at(-1) ?? match)
}
