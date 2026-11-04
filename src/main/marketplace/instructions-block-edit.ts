// Adds or removes one marked block in a user's instructions file (CLAUDE.md, AGENTS.md),
// leaving every other byte as it was.

export type InstructionsBlockId = 'engram' | 'openmetadata'

const START = (id: InstructionsBlockId): string => `<!-- massorca:${id}:start -->`
const END = (id: InstructionsBlockId): string => `<!-- massorca:${id}:end -->`

const BLOCK_TEXT: Record<InstructionsBlockId, readonly string[]> = {
  engram: [
    '## Engram memory (added by MassOrca)',
    '',
    'On any reference to past work, call mem_context, then mem_search, then mem_get_observation.',
    'Save decisions, bug fixes and discoveries with mem_save as they happen.'
  ],
  openmetadata: [
    '## OpenMetadata (added by MassOrca)',
    '',
    'For company data, the glossary, lineage or shared memories, consult the openmetadata MCP server first.'
  ]
}

/** A heading written by hand or by another tool, which MassOrca must not duplicate. */
const FOREIGN_ENGRAM_HEADING = /^#{1,6}\s*Engram Persistent Memory\b/im

function markerLines(text: string, id: InstructionsBlockId): { start: number; end: number } | null {
  const lines = text.split('\n')
  const end = lines.findIndex((line) => line.trim() === END(id))
  // Why: the nearest start before the end, so a stray start marker never widens the cut.
  const start =
    end === -1 ? -1 : lines.slice(0, end).findLastIndex((line) => line.trim() === START(id))
  return start >= 0 ? { start, end } : null
}

export function hasInstructionsBlock(text: string, id: InstructionsBlockId): boolean {
  return markerLines(text, id) !== null
}

/** True when the file already carries an Engram section MassOrca did not write. */
export function hasForeignEngramInstructions(text: string): boolean {
  return !hasInstructionsBlock(text, 'engram') && FOREIGN_ENGRAM_HEADING.test(text)
}

export function withInstructionsBlock(text: string | null, id: InstructionsBlockId): string {
  const source = text ?? ''
  if (hasInstructionsBlock(source, id)) {
    return source
  }
  const eol = source.includes('\r\n') ? '\r\n' : '\n'
  const block = [START(id), ...BLOCK_TEXT[id], END(id)].join(eol)
  if (source.length === 0) {
    return `${block}${eol}`
  }
  // Why: one blank separator line and the file's own final-newline choice, so removal restores it.
  return source.endsWith('\n') ? `${source}${eol}${block}${eol}` : `${source}${eol}${eol}${block}`
}

export function withoutInstructionsBlock(text: string | null, id: InstructionsBlockId): string {
  const source = text ?? ''
  const span = markerLines(source, id)
  if (!span) {
    return source
  }
  const lines = source.split('\n')
  const blankBefore = span.start > 0 && (lines[span.start - 1] ?? '').trim() === ''
  const from = blankBefore ? span.start - 1 : span.start
  const result = [...lines.slice(0, from), ...lines.slice(span.end + 1)].join('\n')
  // Why: a block at the end of a file without a final newline leaves the separator's CR behind.
  return !source.endsWith('\n') && span.end === lines.length - 1 && result.endsWith('\r')
    ? result.slice(0, -1)
    : result
}
