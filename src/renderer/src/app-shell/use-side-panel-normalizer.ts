import { useEffect } from 'react'
import { useAppStore } from '../store'
import { installSidePanelNormalizer } from '../store/slices/tabs/side-panel-normalizer'

/** Keeps sessions in the main area and every other tab in the side panel, whichever code created them. */
export function useSidePanelNormalizer(): void {
  useEffect(() => installSidePanelNormalizer(useAppStore), [])
}
