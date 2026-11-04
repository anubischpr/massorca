import { useCallback, useState } from 'react'
import type { DesignSystemChat } from '../../../src/shared/prototype-design-system-view'
import type { DesignSystemViewState } from '../../../src/shared/prototype-design-system-view-state'
import { useMediaPicker } from '../platform/media-picker'
import type { RpcClient } from '../transport/rpc-client'
import {
  attachDraftImages,
  type MobileDesignSystemImageControls
} from './mobile-prototype-design-system-images'

/** The draft's image attach for the screen: one action shared by "Anything else" and every note. */
export function useMobileDesignSystemImages({
  client,
  target,
  update
}: {
  client: RpcClient | null
  target: DesignSystemChat | undefined
  update: (transform: (state: DesignSystemViewState) => DesignSystemViewState) => void
}): MobileDesignSystemImageControls {
  const picker = useMediaPicker()
  const [attaching, setAttaching] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const worktreeId = target?.worktreeId ?? null
  const attach = useCallback(async (): Promise<void> => {
    if (client === null || target === undefined) {
      return
    }
    setNotice(null)
    const failure = await attachDraftImages({
      client,
      worktreeId,
      pickImages: picker.pickImages,
      update,
      onUploadStart: () => setAttaching(true)
    })
    setAttaching(false)
    setNotice(failure)
  }, [client, picker, target, update, worktreeId])
  return { attach, attaching, notice }
}
