import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  BOT_TEAM_ROOM_ATTACHMENT_FOLDER,
  BOT_TEAM_ROOM_ATTACHMENT_LIMIT,
  type BotTeamRoomAttachment
} from '../../shared/bot-team-room-attachments'

const MAX_DEPTH = 4
const MAX_FILE_BYTES = 25 * 1024 * 1024
// The filesystem's time can trail the host's clock a little.
const CLOCK_SLACK_MS = 1000
const SKIPPED_FOLDERS = new Set(['node_modules', BOT_TEAM_ROOM_ATTACHMENT_FOLDER])

/**
 * The files in a team folder written since a task started, newest first. Versions cannot say what
 * one task changed, so this reads modification times; a bot that edits a file in place is included.
 */
export function listBotTeamDeliverables(folder: string, sinceMs: number): string[] {
  const found: { relative: string; mtimeMs: number }[] = []
  const walk = (directory: string, depth: number): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) {
        continue
      }
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH && !SKIPPED_FOLDERS.has(entry.name)) {
          walk(full, depth + 1)
        }
      } else if (entry.isFile()) {
        const stat = statSync(full)
        if (stat.mtimeMs >= sinceMs - CLOCK_SLACK_MS && stat.size <= MAX_FILE_BYTES) {
          found.push({ relative: path.relative(folder, full), mtimeMs: stat.mtimeMs })
        }
      }
    }
  }
  if (existsSync(folder)) {
    walk(folder, 0)
  }
  return found
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, BOT_TEAM_ROOM_ATTACHMENT_LIMIT)
    .map((file) => file.relative)
}

function teamSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'team'
  )
}

/**
 * Copies files into the asking team's attachments folder as `from-{team}-{name}`, so they open in
 * its Files like any attached file. The room only names files directly inside that folder.
 */
export function copyBotTeamDeliverables(args: {
  fromFolder: string
  relativePaths: readonly string[]
  fromTeamName: string
  toFolder: string
}): BotTeamRoomAttachment[] {
  const target = path.join(args.toFolder, BOT_TEAM_ROOM_ATTACHMENT_FOLDER)
  const copied: BotTeamRoomAttachment[] = []
  for (const relative of args.relativePaths) {
    const name = path.basename(relative)
    const base = `from-${teamSlug(args.fromTeamName)}-${name}`
    let stored = base
    for (let n = 2; existsSync(path.join(target, stored)); n += 1) {
      const dot = base.lastIndexOf('.')
      stored = dot > 0 ? `${base.slice(0, dot)}-${n}${base.slice(dot)}` : `${base}-${n}`
    }
    mkdirSync(target, { recursive: true })
    copyFileSync(path.join(args.fromFolder, relative), path.join(target, stored))
    copied.push({ path: `${BOT_TEAM_ROOM_ATTACHMENT_FOLDER}/${stored}`, name })
  }
  return copied
}
