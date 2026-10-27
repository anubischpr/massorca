import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { readIpcErrorMessage } from '@/lib/ipc-error'

export function showFileLinkNotFoundToast(filePath: string): void {
  toast.error(
    translate('components.native-chat.fileLinks.notFound', 'File not found: {{value0}}', {
      value0: filePath
    })
  )
}

/** The host could not be asked whether the file exists, so the toast must not claim it is gone. */
export function showFileLinkUnverifiableToast(filePath: string, error: unknown): void {
  toast.error(
    translate(
      'components.native-chat.fileLinks.unverifiable',
      "Couldn't check {{value0}}: {{value1}}",
      {
        value0: filePath,
        value1: readIpcErrorMessage(error) ?? String(error)
      }
    )
  )
}

/** The worktree is the boundary on a paired host, and the host has no record of the chat saving this. */
export function showFileLinkOutsideRemoteWorkspaceToast(): void {
  toast.error(
    translate(
      'components.native-chat.fileLinks.outsideRemoteWorkspace',
      "This file is outside the workspace on the remote host, so Orca can't open it."
    )
  )
}

/** Only a newer host can read what the agent saved outside the workspace; this one answered no such method. */
export function showFileLinkRemoteHostOutdatedToast(): void {
  toast.error(
    translate(
      'components.native-chat.fileLinks.remoteHostOutdated',
      'Update Orca on the remote host to open files the agent saved outside the workspace.'
    )
  )
}

/** e.g. `~/x` when the workspace gives no way to know the home folder. */
export function showFileLinkUnresolvedToast(pathText: string): void {
  toast.error(
    translate(
      'components.native-chat.fileLinks.unresolved',
      "Couldn't resolve {{value0}} in this workspace",
      { value0: pathText }
    )
  )
}
