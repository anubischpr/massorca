import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'
import { classifyAgentSessionFunctions } from '../../shared/agent-session-provider-functions'
import type { AgentSessionRecord } from '../../shared/agent-session-record'
import type { AgentSessionSlashCommand } from '../../shared/agent-session-wire'
import { isPiRuntimeSelection, type PiRuntimeSelection } from '../../shared/pi-runtime-selection'
import type { StructuredAgentSessionAtRestCommands } from '../native-chat/agent-session-wire/structured-agent-session-at-rest-commands'

const SCHEMA_VERSION = 1
const SAVE_COALESCE_MS = 500
const MAX_COMMANDS = 512

const savedCommandSchema = z.object({
  name: z.string().min(1).max(256),
  kind: z.enum(['command', 'skill']),
  kindUnspecified: z.literal(true).optional(),
  description: z.string().max(2_000).optional(),
  argumentHint: z.string().max(200).optional()
})
const savedFileSchema = z.object({
  version: z.literal(SCHEMA_VERSION),
  runtimes: z.record(z.string(), z.array(savedCommandSchema).max(MAX_COMMANDS))
})

/** A record that names no runtime is stock Pi. */
function runtimeOf(options: Readonly<Record<string, string>> | undefined): PiRuntimeSelection {
  return isPiRuntimeSelection(options?.piRuntime) ? options.piRuntime : 'pi'
}

/**
 * The `/` commands each Pi runtime last reported from a running child, kept so a chat whose child
 * is not running still offers them. The list is what that runtime reported for some earlier
 * session, not for this one, so a reader presents it as unverified until a child answers again.
 */
export class PiRpcCommandCatalog {
  private readonly lists = new Map<PiRuntimeSelection, AgentSessionSlashCommand[]>()
  private readonly listeners = new Set<() => void>()
  private saveTimer: ReturnType<typeof setTimeout> | undefined
  private readonly loaded: Promise<void>

  constructor(private readonly file?: string) {
    this.loaded = this.load()
  }

  read(runtime: PiRuntimeSelection): AgentSessionSlashCommand[] | undefined {
    return this.lists.get(runtime)
  }

  /** Remembers what a running child reported; an empty report is not remembered. */
  record(runtime: PiRuntimeSelection, commands: readonly AgentSessionSlashCommand[]): void {
    if (commands.length === 0 || commands.length > MAX_COMMANDS) {
      return
    }
    const next = commands.map((command) => ({ ...command }))
    if (JSON.stringify(this.lists.get(runtime)) === JSON.stringify(next)) {
      return
    }
    this.lists.set(runtime, next)
    this.notify()
    this.scheduleSave()
  }

  /** Remembers what the child of a session with these options reported. */
  recordFor(
    options: Readonly<Record<string, string>> | undefined,
    commands: readonly AgentSessionSlashCommand[]
  ): void {
    this.record(runtimeOf(options), commands)
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** The `/` surface of a Pi chat whose child is not running: what its runtime last reported, offered
   *  as unverified until a child answers for this session. */
  atRestCommands(): StructuredAgentSessionAtRestCommands {
    const read = (record: AgentSessionRecord) =>
      record.provider === 'pi' ? this.read(runtimeOf(record.options)) : undefined
    return {
      read,
      readFunctions: (record) =>
        classifyAgentSessionFunctions({ commands: read(record), source: 'provider-files' }),
      onChange: (listener) => this.onChange(listener)
    }
  }

  /** Writes a coalesced save now; the delay timer is unref'd, so quit must not rely on it. */
  async flush(): Promise<void> {
    await this.loaded
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = undefined
      await this.save()
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }

  private async load(): Promise<void> {
    if (!this.file) {
      return
    }
    try {
      const parsed = savedFileSchema.safeParse(JSON.parse(await readFile(this.file, 'utf8')))
      if (!parsed.success) {
        return
      }
      let changed = false
      for (const [runtime, commands] of Object.entries(parsed.data.runtimes)) {
        // A report this process already holds is newer than the saved one.
        if (isPiRuntimeSelection(runtime) && !this.lists.has(runtime) && commands.length > 0) {
          this.lists.set(runtime, commands)
          changed = true
        }
      }
      if (changed) {
        this.notify()
      }
    } catch {
      // Missing or unreadable: the next running child writes a fresh one.
    }
  }

  private scheduleSave(): void {
    if (!this.file) {
      return
    }
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined
      void this.save()
    }, SAVE_COALESCE_MS)
    this.saveTimer.unref()
  }

  private async save(): Promise<void> {
    const { file } = this
    if (!file) {
      return
    }
    try {
      const body = JSON.stringify({
        version: SCHEMA_VERSION,
        runtimes: Object.fromEntries(this.lists)
      })
      const temporary = `${file}.${process.pid}.tmp`
      await mkdir(dirname(file), { recursive: true })
      await writeFile(temporary, body, 'utf8')
      await rename(temporary, file)
    } catch {
      // A lost write only costs the at-rest list until the next child reports.
    }
  }
}
