import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store'
import { createNativeChatFileLinkContextSelector } from './native-chat-file-link'

export function useNativeChatFileLinkContext(terminalTabId: string, sessionId?: string) {
  const selectContext = useMemo(
    () => createNativeChatFileLinkContextSelector(terminalTabId),
    [terminalTabId]
  )
  const context = useAppStore(useShallow(selectContext))
  return useMemo(
    () => (context && sessionId ? { ...context, sessionId } : context),
    [context, sessionId]
  )
}
