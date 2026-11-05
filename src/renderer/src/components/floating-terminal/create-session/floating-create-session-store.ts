import { create } from 'zustand'

// Why a store: the tab strip's menu and the header button open it, and the panel body renders it.
export const useFloatingCreateSessionStore = create<{
  open: boolean
  setOpen: (open: boolean) => void
}>()((set) => ({
  open: false,
  setOpen: (open) => set({ open })
}))
