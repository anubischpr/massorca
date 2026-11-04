import React, { useMemo } from 'react'
import { create } from 'zustand'
import { showHostSessionInFloating } from '@/lib/floating-workspace-host-session'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../../shared/constants'
import { listFloatingSessionPickerGroups } from './floating-session-picker-groups'
import { FloatingSessionPicker } from './FloatingSessionPicker'

// Why a store: the "+" menu asks for the picker, and the menu closes before the picker opens.
export const useFloatingOpenSessionPickerStore = create<{
  open: boolean
  setOpen: (open: boolean) => void
}>()((set) => ({
  open: false,
  setOpen: (open) => set({ open })
}))

/**
 * "Open a session...": every Workspaces session not already shown elsewhere, opened in the
 * floating workspace by reference, so it keeps running in its own workspace.
 */
export function FloatingOpenSessionPicker(): React.JSX.Element {
  const open = useFloatingOpenSessionPickerStore((s) => s.open)
  const setOpen = useFloatingOpenSessionPickerStore((s) => s.setOpen)
  const unifiedTabsByWorktree = useAppStore((s) => s.unifiedTabsByWorktree)
  const groups = useMemo(
    () =>
      open && unifiedTabsByWorktree
        ? listFloatingSessionPickerGroups(useAppStore.getState(), {
            layoutWorktreeId: FLOATING_TERMINAL_WORKTREE_ID
          })
        : [],
    [open, unifiedTabsByWorktree]
  )
  return (
    <FloatingSessionPicker
      open={open}
      onOpenChange={setOpen}
      groups={groups}
      onPick={(candidate) => showHostSessionInFloating(candidate.worktreeId, candidate.tabId)}
    >
      {/* Why an empty anchor under the "+": the menu item that opens the picker is gone by then. */}
      <span aria-hidden className="pointer-events-none absolute top-9 left-2 size-0" />
    </FloatingSessionPicker>
  )
}
