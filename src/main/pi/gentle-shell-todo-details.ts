import { z } from 'zod'

// What Gentle Shell (gentle-pi) attaches to its `todo` tool results: the full list under
// `details.gentleTodo`. It is read exactly as published; a shape that does not match is ignored.

export const GENTLE_TODO_TOOL = 'todo'

const MAX_TODO_TASKS = 200
const MAX_TODO_TEXT = 1_000

const todoTaskSchema = z.looseObject({
  title: z.string().min(1),
  status: z.string(),
  note: z.string().optional()
})

const todoDetailsSchema = z.looseObject({
  gentleTodo: z.looseObject({ tasks: z.array(todoTaskSchema).max(MAX_TODO_TASKS) }),
  error: z.unknown().optional()
})

export type GentleTodoTask = { title: string; status: string; note?: string }

/** The todo list a successful `todo` result holds; absent for any other tool, an error, or a shape
 *  Gentle Shell did not publish. */
export function readGentleTodoSnapshot(details: unknown): GentleTodoTask[] | undefined {
  const parsed = todoDetailsSchema.safeParse(details)
  if (!parsed.success || parsed.data.error !== undefined) {
    return undefined
  }
  return parsed.data.gentleTodo.tasks.map((task) => ({
    title: task.title.slice(0, MAX_TODO_TEXT),
    status: task.status,
    ...(task.note ? { note: task.note.slice(0, MAX_TODO_TEXT) } : {})
  }))
}
