import type { NativeChatTask, NativeChatTaskList } from './native-chat-task-list'

// Claude Code 2.1.x replaces TodoWrite snapshots with TaskCreate/TaskUpdate calls, so the list is
// the fold of every call. Claude's own task reducer is the reference: a create is shown as pending
// until its result names the task id, an update patches by id, and `deleted` removes the entry.

const CREATED_RESULT = /Task #(\S+) created successfully/

type LedgerStatus = NativeChatTask['status'] | 'deleted'

export type NativeChatTaskLedger = {
  tasks: Map<string, NativeChatTask>
  /** Creates whose id is not known yet, keyed by call id. */
  creating: Map<string, NativeChatTask>
}

export function createNativeChatTaskLedger(): NativeChatTaskLedger {
  return { tasks: new Map(), creating: new Map() }
}

export function isNativeChatTaskLedgerTool(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  return normalized === 'taskcreate' || normalized === 'taskupdate'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function ledgerStatus(value: unknown): LedgerStatus | undefined {
  return value === 'pending' ||
    value === 'in_progress' ||
    value === 'completed' ||
    value === 'deleted'
    ? value
    : undefined
}

function parsedInput(input: unknown): Record<string, unknown> | null {
  if (typeof input !== 'string') {
    return isRecord(input) ? input : null
  }
  try {
    const parsed: unknown = JSON.parse(input)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Claude accepts `id`/`task_id` and `active_form` as aliases for the documented names. */
function field(input: Record<string, unknown>, ...names: string[]): unknown {
  return names.map((name) => input[name]).find((value) => value !== undefined)
}

function withActiveForm(task: NativeChatTask, activeForm: string | undefined): NativeChatTask {
  return activeForm && activeForm !== task.content ? { ...task, activeForm } : task
}

export function observeNativeChatTaskCall(
  ledger: NativeChatTaskLedger,
  call: { callId: string; name: string; input: unknown }
): void {
  const input = parsedInput(call.input)
  if (!input) {
    return
  }
  const name = call.name.trim().toLowerCase()
  const subject = text(input.subject)
  const activeForm = text(field(input, 'activeForm', 'active_form'))
  if (name === 'taskcreate') {
    if (subject) {
      ledger.creating.set(
        call.callId,
        withActiveForm({ content: subject, status: 'pending' }, activeForm)
      )
    }
    return
  }
  const id = text(field(input, 'taskId', 'task_id', 'id'))
  if (name !== 'taskupdate' || !id) {
    return
  }
  const status = ledgerStatus(input.status)
  if (status === 'deleted') {
    ledger.tasks.delete(id)
    return
  }
  const known = ledger.tasks.get(id)
  const content = subject ?? known?.content ?? id
  const kept = known?.activeForm
  ledger.tasks.set(
    id,
    withActiveForm(
      {
        content,
        status: status ?? known?.status ?? 'pending',
        ...(kept ? { activeForm: kept } : {})
      },
      activeForm
    )
  )
}

export function observeNativeChatTaskResult(
  ledger: NativeChatTaskLedger,
  result: { callId: string; output: string; isError: boolean }
): void {
  const created = ledger.creating.get(result.callId)
  if (!created) {
    return
  }
  if (result.isError) {
    ledger.creating.delete(result.callId)
    return
  }
  const id = CREATED_RESULT.exec(result.output)?.[1]
  if (!id) {
    return
  }
  ledger.creating.delete(result.callId)
  if (!ledger.tasks.has(id)) {
    ledger.tasks.set(id, created)
  }
}

/** Null until a create or update has been seen, so a snapshot plan is never replaced by nothing. */
export function nativeChatTaskLedgerList(ledger: NativeChatTaskLedger): NativeChatTaskList | null {
  const tasks = [...ledger.tasks.values(), ...ledger.creating.values()]
  return tasks.length > 0 ? { tasks } : null
}
