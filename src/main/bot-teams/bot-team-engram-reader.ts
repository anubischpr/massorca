import { runProcess } from '../../shared/child-process/run-process'
import type { BotTeamEngramMemory } from '../../shared/rpc-contract/bot-team-engram-params'

const ENGRAM_TIMEOUT_MS = 10_000
const EXCERPT_MAX_CHARS = 240

export type EngramRun = { code: number | null; stdout: string; timedOut: boolean }
/** Runs `engram <args>`; rejects only when the program could not start. */
export type EngramRunner = (args: readonly string[]) => Promise<EngramRun>

export type EngramReadResult =
  | { status: 'ok'; memories: BotTeamEngramMemory[] }
  | { status: 'unavailable' | 'failed' }

export const runEngramCli: EngramRunner = async (args) => {
  const result = await runProcess({ program: 'engram', args, timeoutMs: ENGRAM_TIMEOUT_MS })
  return { code: result.code, stdout: result.stdout, timedOut: result.timedOut }
}

function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > EXCERPT_MAX_CHARS ? `${flat.slice(0, EXCERPT_MAX_CHARS - 1)}…` : flat
}

const SEARCH_HEADER = /^\[\d+\] #(\d+) \(([^)]*)\) — (.*)$/
const SEARCH_DATE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \|/

/** Reads `engram search` output; lines it does not recognise (the update banner) are skipped. */
export function parseEngramSearch(stdout: string): BotTeamEngramMemory[] {
  const memories: BotTeamEngramMemory[] = []
  let open: { id: string; type: string; title: string; body: string[] } | null = null
  const close = (createdAt?: string): void => {
    if (open) {
      memories.push({
        id: open.id,
        title: open.title,
        ...(open.type ? { type: open.type } : {}),
        excerpt: clip(open.body.join(' ')),
        ...(createdAt ? { createdAt } : {})
      })
      open = null
    }
  }
  for (const line of stdout.split(/\r?\n/)) {
    const header = SEARCH_HEADER.exec(line)
    if (header) {
      close()
      open = { id: header[1], type: header[2], title: header[3].trim(), body: [] }
      continue
    }
    if (!open) {
      continue
    }
    const date = SEARCH_DATE.exec(line.trim())
    if (date) {
      close(date[1])
    } else if (line.trim()) {
      open.body.push(line.trim())
    }
  }
  close()
  return memories
}

const CONTEXT_OBSERVATION = /^- \[([^\]]*)\] \*\*(.*?)\*\*: (.*)$/

/** Reads the "Recent Observations" list of `engram context`, newest first; it carries no ids. */
export function parseEngramContext(stdout: string): BotTeamEngramMemory[] {
  const memories: BotTeamEngramMemory[] = []
  let inRecent = false
  for (const line of stdout.split(/\r?\n/)) {
    if (line.startsWith('### ')) {
      inRecent = line.trim() === '### Recent Observations'
      continue
    }
    const match = inRecent ? CONTEXT_OBSERVATION.exec(line) : null
    if (match) {
      memories.push({
        id: `recent-${memories.length + 1}`,
        title: match[2].trim(),
        ...(match[1] ? { type: match[1] } : {}),
        excerpt: clip(match[3])
      })
    }
  }
  return memories
}

/** A leading dash would read as a flag; the query is otherwise passed through as one argument. */
function searchTerm(query: string): string {
  return query.trim().replace(/^-+/, '').trim()
}

/**
 * Read-only: `engram context` for the latest memories, `engram search` for a query.
 * Never throws; a missing CLI is 'unavailable' and any other trouble is 'failed'.
 */
export async function readEngramMemories(
  run: EngramRunner,
  input: { project: string; query?: string; limit: number }
): Promise<EngramReadResult> {
  const term = searchTerm(input.query ?? '')
  const args = term
    ? ['search', term, '--project', input.project, '--limit', String(input.limit)]
    : ['context', input.project]
  try {
    const result = await run(args)
    if (result.timedOut || result.code !== 0) {
      return { status: 'failed' }
    }
    const parsed = term ? parseEngramSearch(result.stdout) : parseEngramContext(result.stdout)
    return { status: 'ok', memories: parsed.slice(0, input.limit) }
  } catch (error) {
    const missing = typeof error === 'object' && error !== null && 'code' in error
    return { status: missing && error.code === 'ENOENT' ? 'unavailable' : 'failed' }
  }
}
