import { dirname, join } from 'node:path'
import { ANTIGRAVITY_HISTORY_ROOTS } from '../../shared/antigravity-session-origin'

const ANTIGRAVITY_TRANSCRIPT_FILE = 'transcript.jsonl'
const ANTIGRAVITY_SYSTEM_DIR = '.system_generated'
const ANTIGRAVITY_LOGS_DIR = 'logs'

export function antigravityConversationIdFromTranscriptPath(filePath: string): string | null {
  const segments = pathSegments(filePath)
  const transcriptIndex = segments.length - 1
  if (
    ![ANTIGRAVITY_TRANSCRIPT_FILE, 'transcript_full.jsonl'].includes(
      segments[transcriptIndex] ?? ''
    ) ||
    segments[transcriptIndex - 1] !== ANTIGRAVITY_LOGS_DIR ||
    segments[transcriptIndex - 2] !== ANTIGRAVITY_SYSTEM_DIR
  ) {
    return null
  }
  return segments[transcriptIndex - 3] ?? null
}

export function isAntigravityTranscriptPath(filePath: string): boolean {
  return antigravityConversationIdFromTranscriptPath(filePath) !== null
}

export function shouldDescendAntigravityBrainDirectory(name: string, depth: number): boolean {
  // Why: brain entries contain large artifact trees; only the fixed transcript
  // chain is part of the resumable conversation contract.
  if (depth === 0) {
    return true
  }
  if (depth === 1) {
    return name === ANTIGRAVITY_SYSTEM_DIR
  }
  return depth === 2 && name === ANTIGRAVITY_LOGS_DIR
}

/** Every transcript path a conversation id could live at under one home, one per brain origin. */
export function antigravityTranscriptPathsForConversation(
  conversationId: string,
  homeDir: string
): string[] {
  if (
    !conversationId ||
    conversationId === '.' ||
    conversationId === '..' ||
    /[\\/]/.test(conversationId)
  ) {
    return []
  }
  return ANTIGRAVITY_HISTORY_ROOTS.map((origin) =>
    join(
      homeDir,
      '.gemini',
      origin,
      'brain',
      conversationId,
      ANTIGRAVITY_SYSTEM_DIR,
      ANTIGRAVITY_LOGS_DIR,
      ANTIGRAVITY_TRANSCRIPT_FILE
    )
  )
}

export function antigravityHistoryPathForBrainDir(brainDir: string): string {
  return join(dirname(brainDir), 'history.jsonl')
}

function pathSegments(filePath: string): string[] {
  return filePath.split(/[\\/]+/).filter(Boolean)
}
