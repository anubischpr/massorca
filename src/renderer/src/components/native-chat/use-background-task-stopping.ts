import { useState } from 'react'

type StoppingBackgroundTasks = {
  sessionId: string
  taskIds: ReadonlySet<string>
  all: boolean
}

const NO_STOPPING_TASKS: ReadonlySet<string> = new Set()

export type BackgroundTaskStopping = {
  stoppingTaskIds: ReadonlySet<string>
  stoppingAll: boolean
  onStop: (taskId?: string) => void
}

/** The session's background stops still waiting on the host. The strip and the summary card read
 *  one copy, so a task stopped from either one disables its Stop in both until the host answers. */
export function useBackgroundTaskStopping(input: {
  sessionId: string
  stopBackgroundTask: (taskId?: string) => Promise<unknown>
}): BackgroundTaskStopping {
  const [stopping, setStopping] = useState<StoppingBackgroundTasks | null>(null)
  const { sessionId, stopBackgroundTask } = input
  const active = stopping?.sessionId === sessionId ? stopping : null
  const onStop = (taskId?: string) => {
    setStopping((current) => {
      const taskIds = new Set(
        current?.sessionId === sessionId ? current.taskIds : NO_STOPPING_TASKS
      )
      if (taskId) {
        taskIds.add(taskId)
      }
      return {
        sessionId,
        taskIds,
        all: taskId ? current?.sessionId === sessionId && current.all : true
      }
    })
    void stopBackgroundTask(taskId).finally(() => {
      setStopping((current) => {
        if (current?.sessionId !== sessionId) {
          return current
        }
        const taskIds = new Set(current.taskIds)
        if (taskId) {
          taskIds.delete(taskId)
        }
        const all = taskId ? current.all : false
        return taskIds.size === 0 && !all ? null : { sessionId, taskIds, all }
      })
    })
  }
  return {
    stoppingTaskIds: active?.taskIds ?? NO_STOPPING_TASKS,
    stoppingAll: active?.all ?? false,
    onStop
  }
}
