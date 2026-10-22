import { createReadStream } from 'node:fs'
import { open } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { Readable } from 'node:stream'
import { z } from 'zod'
import { resolveSessionFilePath } from './session-file-resolver'

// A Codex thread forked in `paginated` history mode writes a rollout that holds only what happened
// after the fork. Its `session_meta` names the parent thread and the byte offset of the parent's
// rollout that the fork inherited, so the conversation reads as the parent's prefix, then this file.

const MAX_META_LINE_BYTES = 1024 * 1024
const MAX_FORK_DEPTH = 16

type HistorySegment = { path: string; endByte?: number }

async function readFirstLine(path: string): Promise<string | null> {
  const handle = await open(path, 'r')
  try {
    const chunks: Buffer[] = []
    let total = 0
    for (;;) {
      const buffer = Buffer.alloc(64 * 1024)
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, total)
      if (bytesRead === 0) {
        break
      }
      const chunk = buffer.subarray(0, bytesRead)
      const newline = chunk.indexOf(0x0a)
      chunks.push(newline === -1 ? chunk : chunk.subarray(0, newline))
      total += bytesRead
      if (newline !== -1 || total > MAX_META_LINE_BYTES) {
        break
      }
    }
    return total > MAX_META_LINE_BYTES ? null : Buffer.concat(chunks).toString('utf8')
  } finally {
    await handle.close()
  }
}

const rolloutMetaSchema = z.looseObject({
  payload: z.looseObject({
    history_base: z.looseObject({
      thread_id: z.string(),
      end_byte_offset: z.number().refine((end) => Number.isSafeInteger(end) && end > 0)
    })
  })
})

/** The thread and parent-rollout byte count a forked rollout inherits, or null for any other rollout. */
function historyBase(metaLine: string): { threadId: string; endByteOffset: number } | null {
  try {
    const meta = rolloutMetaSchema.safeParse(JSON.parse(metaLine))
    if (!meta.success) {
      return null
    }
    const base = meta.data.payload.history_base
    return { threadId: base.thread_id, endByteOffset: base.end_byte_offset }
  } catch {
    return null
  }
}

/** `sessions/YYYY/MM/DD/<rollout>.jsonl` → the `sessions` directory the thread lives under. */
function sessionsRoot(rolloutPath: string): string {
  let directory = dirname(rolloutPath)
  for (let depth = 0; depth < 4; depth += 1) {
    if (basename(directory) === 'sessions') {
      return directory
    }
    directory = dirname(directory)
  }
  return dirname(dirname(dirname(dirname(rolloutPath))))
}

async function historySegments(path: string, depth: number): Promise<HistorySegment[]> {
  const metaLine = depth < MAX_FORK_DEPTH ? await readFirstLine(path) : null
  const base = metaLine === null ? null : historyBase(metaLine)
  if (!base) {
    return [{ path }]
  }
  const parent = await resolveSessionFilePath('codex', base.threadId, {
    codexSessionsDirs: [sessionsRoot(path)]
  })
  if (!parent) {
    // The inherited history is gone: the fork's own lines are all there is to show.
    return [{ path }]
  }
  const inherited = await historySegments(parent, depth + 1)
  const last = inherited.at(-1)
  return [
    ...inherited.slice(0, -1),
    ...(last ? [{ ...last, endByte: base.endByteOffset }] : []),
    { path }
  ]
}

/** A rollout's lines in conversation order: a forked thread's inherited history first. */
export async function openCodexRolloutHistory(path: string): Promise<Readable> {
  const segments = await historySegments(path, 0)
  const first = segments[0]
  if (segments.length === 1 && first) {
    return createReadStream(first.path)
  }
  return Readable.from(
    (async function* () {
      for (const segment of segments) {
        yield* createReadStream(
          segment.path,
          segment.endByte === undefined ? {} : { end: segment.endByte - 1 }
        )
      }
    })()
  )
}
