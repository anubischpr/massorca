import { useAppStore } from '@/store'
import { usePrototypeViewStore } from './prototype-view-store'

/** Opens the Prototypes view on a project's Design system. */
export function openPrototypeDesignSystem(projectKey: string): void {
  usePrototypeViewStore.getState().selectDesignSystem(projectKey)
  useAppStore.getState().setActiveView('prototypes')
}
