/** A stored command is one short argv, not a script. */
export const MAX_CUSTOM_COMMAND_LENGTH = 1_000

/** Shell operators: no argv needs them, and a shell would act on them. */
const SHELL_OPERATORS = new Set(['|', '&', ';', '<', '>', '$', '`'])

export function isControlCharacter(char: string): boolean {
  const code = char.charCodeAt(0)
  return code < 0x20 || code === 0x7f
}

function isRefused(char: string): boolean {
  // Why: a newline or other control character can split one command across lines or hide text.
  if (isControlCharacter(char) && char !== '\t') {
    return true
  }
  return SHELL_OPERATORS.has(char)
}

/**
 * Splits a typed command into argv without a shell. Spaces and tabs separate arguments, and
 * "double" or 'single' quotes keep spaces together. A backslash is an ordinary character, so
 * Windows paths survive. Returns null for a blank program, an unclosed quote, or a refused
 * character, quoted or not.
 */
export function parseCustomCommandArgv(text: string): readonly string[] | null {
  if (text.length > MAX_CUSTOM_COMMAND_LENGTH) {
    return null
  }
  const argv: string[] = []
  let current = ''
  let inArgument = false
  let quote: '"' | "'" | null = null
  for (const char of text) {
    if (isRefused(char)) {
      return null
    }
    if (quote !== null) {
      if (char === quote) {
        quote = null
      } else {
        current += char
      }
    } else if (char === '"' || char === "'") {
      quote = char
      inArgument = true
    } else if (char === ' ' || char === '\t') {
      if (inArgument) {
        argv.push(current)
        current = ''
        inArgument = false
      }
    } else {
      current += char
      inArgument = true
    }
  }
  if (quote !== null) {
    return null
  }
  if (inArgument) {
    argv.push(current)
  }
  const [program = ''] = argv
  return program.trim() === '' ? null : argv
}
