/**
 * The part of .gitignore a team's versions honour without Git: comments, `!` re-inclusion, a
 * trailing `/` for folders, `*`, `?` and `**`, and a slash that anchors a pattern to the folder.
 */
export type IgnoreRules = (relativePath: string, isDirectory: boolean) => boolean

type Rule = { pattern: RegExp; negate: boolean; directoryOnly: boolean }

function escapeRegExp(text: string): string {
  return text.replace(/[.+^${}()|[\]\\]/g, '\\$&')
}

function segmentPattern(segment: string): string {
  return escapeRegExp(segment).replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')
}

function globPattern(glob: string): string {
  const segments = glob.split('/')
  let source = ''
  segments.forEach((segment, index) => {
    const last = index === segments.length - 1
    if (segment === '**') {
      source += last ? '.*' : '(?:.*/)?'
    } else {
      source += segmentPattern(segment) + (last ? '' : '/')
    }
  })
  return source
}

function ruleOf(line: string): Rule | null {
  let pattern = line.replace(/\s+$/, '')
  if (pattern === '' || pattern.startsWith('#')) {
    return null
  }
  let negate = false
  if (pattern.startsWith('!')) {
    negate = true
    pattern = pattern.slice(1)
  } else if (pattern.startsWith('\\')) {
    pattern = pattern.slice(1)
  }
  let directoryOnly = false
  if (pattern.endsWith('/')) {
    directoryOnly = true
    pattern = pattern.slice(0, -1)
  }
  const anchored = pattern.includes('/')
  pattern = pattern.replace(/^\//, '')
  if (pattern === '') {
    return null
  }
  const body = globPattern(pattern)
  const source = anchored ? `^${body}$` : `(?:^|/)${body}$`
  return { pattern: new RegExp(source), negate, directoryOnly }
}

/** Reads a .gitignore's text into a matcher; the last rule that matches decides. */
export function parseIgnoreRules(text: string): IgnoreRules {
  const rules = text
    .split(/\r?\n/)
    .map(ruleOf)
    .filter((rule): rule is Rule => rule !== null)

  const matches = (relativePath: string, isDirectory: boolean): boolean => {
    let ignored = false
    for (const rule of rules) {
      if ((!rule.directoryOnly || isDirectory) && rule.pattern.test(relativePath)) {
        ignored = !rule.negate
      }
    }
    return ignored
  }

  return (relativePath, isDirectory) => {
    const segments = relativePath.split('/')
    // An ignored folder takes everything inside it, so each ancestor folder counts.
    for (let depth = 1; depth < segments.length; depth += 1) {
      if (matches(segments.slice(0, depth).join('/'), true)) {
        return true
      }
    }
    return matches(relativePath, isDirectory)
  }
}
