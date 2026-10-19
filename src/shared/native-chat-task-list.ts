export type NativeChatTaskStatus = 'pending' | 'in_progress' | 'completed'
export type NativeChatTask = {
  content: string
  status: NativeChatTaskStatus
  activeForm?: string
}
export type NativeChatTaskList = { tasks: NativeChatTask[]; explanation?: string }
export type NativeChatTaskChange = {
  kind: 'added' | 'removed' | 'started' | 'completed' | 'pending' | 'updated'
  task: NativeChatTask
}
export type NativeChatTaskListTool = 'todowrite' | 'update_plan' | 'todo'

export function nativeChatTaskListTool(name: string): NativeChatTaskListTool | null {
  const normalized = name.trim().toLowerCase()
  return normalized === 'todowrite' || normalized === 'update_plan' || normalized === 'todo'
    ? normalized
    : null
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function nonemptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** Gentle Shell's `todo` tool is an action stream: only the snapshot its result carries (`gentleTodo`,
 *  attached by the host) is a plan, never the call's own arguments. A blocked task is open and reads
 *  as pending; a dropped one is neither open nor done, so it is left out. */
function gentleTodoList(value: Record<string, unknown> | null): NativeChatTaskList | null {
  const entries = record(value?.gentleTodo)?.tasks
  if (!Array.isArray(entries)) {
    return null
  }
  const tasks: NativeChatTask[] = []
  for (const entry of entries) {
    const item = record(entry)
    const content = nonemptyString(item?.title)
    if (!item || !content || item.status === 'dropped') {
      continue
    }
    const status =
      item.status === 'in_progress'
        ? 'in_progress'
        : item.status === 'done'
          ? 'completed'
          : 'pending'
    const activeForm = status === 'in_progress' ? nonemptyString(item.note) : undefined
    tasks.push({ content, status, ...(activeForm ? { activeForm } : {}) })
  }
  return { tasks }
}

export function normalizeNativeChatTaskList(
  name: string,
  input: unknown
): NativeChatTaskList | null {
  const tool = nativeChatTaskListTool(name)
  if (!tool) {
    return null
  }
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input)
    } catch {
      return null
    }
  }
  const value = record(input)
  if (tool === 'todo') {
    return gentleTodoList(value)
  }
  const entries = tool === 'todowrite' ? value?.todos : value?.plan
  if (!Array.isArray(entries)) {
    return null
  }
  const tasks: NativeChatTask[] = []
  for (const entry of entries) {
    const item = record(entry)
    const content = nonemptyString(tool === 'todowrite' ? item?.content : item?.step)
    if (!item || !content) {
      continue
    }
    const status =
      item.status === 'in_progress' || (tool === 'update_plan' && item.status === 'inProgress')
        ? 'in_progress'
        : item.status === 'completed'
          ? 'completed'
          : 'pending'
    const activeForm = tool === 'todowrite' ? nonemptyString(item.activeForm) : undefined
    tasks.push({ content, status, ...(activeForm ? { activeForm } : {}) })
  }
  if (entries.length > 0 && tasks.length === 0) {
    return null
  }
  const explanation = tool === 'update_plan' ? nonemptyString(value?.explanation) : undefined
  return { tasks, ...(explanation ? { explanation } : {}) }
}

export function nativeChatTaskLabel(task: NativeChatTask): string {
  return task.status === 'in_progress' && task.activeForm ? task.activeForm : task.content
}

/** Content plus occurrence is the only identity the providers give these entries. */
export function diffNativeChatTaskLists(
  previous: NativeChatTaskList,
  current: NativeChatTaskList
): NativeChatTaskChange[] {
  const byContent = new Map<string, NativeChatTask[]>()
  for (const task of previous.tasks) {
    const matches = byContent.get(task.content)
    if (matches) {
      matches.push(task)
    } else {
      byContent.set(task.content, [task])
    }
  }
  const occurrences = new Map<string, number>()
  const consumed = new Set<NativeChatTask>()
  const changes: NativeChatTaskChange[] = []
  for (const task of current.tasks) {
    const occurrence = occurrences.get(task.content) ?? 0
    occurrences.set(task.content, occurrence + 1)
    const before = byContent.get(task.content)?.[occurrence]
    if (!before) {
      changes.push({ kind: 'added', task })
      continue
    }
    consumed.add(before)
    if (before.status !== task.status) {
      changes.push({
        kind:
          task.status === 'completed'
            ? 'completed'
            : task.status === 'in_progress'
              ? 'started'
              : 'pending',
        task
      })
    } else if (before.activeForm !== task.activeForm) {
      changes.push({ kind: 'updated', task })
    }
  }
  for (const task of previous.tasks) {
    if (!consumed.has(task)) {
      changes.push({ kind: 'removed', task })
    }
  }
  return changes
}
