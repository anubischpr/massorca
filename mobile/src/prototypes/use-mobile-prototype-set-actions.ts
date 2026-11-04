import { useState } from 'react'
import { Alert } from 'react-native'
import { Archive, ArchiveRestore } from 'lucide-react-native'
import type { PrototypeListRow } from '../../../src/shared/prototype-list-model'
import type { ActionSheetAction } from '../components/ActionSheetModal'
import {
  archiveMobilePrototypeRequest,
  deleteMobilePrototypeRequest,
  hostMayArchivePrototypes,
  unarchiveMobilePrototypeRequest,
  type MobilePrototypeSetAction
} from '../session/mobile-prototype-host-rpc'
import type { RpcClient } from '../transport/rpc-client'

type SetTarget = { sessionId: string; requestId: string }

/**
 * The row actions of the Prototypes list: Archive on a set, Unarchive on an archived one, and Delete on any
 * set the host lists as deletable, behind the row's sheet. Delete asks first, and the list is read again after every action.
 */
export function useMobilePrototypeSetActions(
  client: RpcClient | null,
  reload: () => void
): {
  /** False while the host is unknown or showed it predates archiving. */
  canAct: boolean
  menuRow: PrototypeListRow | null
  menuActions: ActionSheetAction[]
  openMenu: (row: PrototypeListRow) => void
  closeMenu: () => void
} {
  const [menuRow, setMenuRow] = useState<PrototypeListRow | null>(null)
  // Why: a host that predates archiving answers its actions as a missing method, and then offers none.
  const [hostLacksArchive, setHostLacksArchive] = useState(false)
  const run = async (
    send: (target: SetTarget) => Promise<MobilePrototypeSetAction>,
    row: PrototypeListRow
  ): Promise<void> => {
    const result = await send({ sessionId: row.set.sessionId, requestId: row.set.requestId })
    if (result.kind === 'unsupported-host') {
      setHostLacksArchive(true)
    } else if (result.kind === 'unreachable') {
      Alert.alert('Could not reach your computer', 'Try again in a moment.')
    } else if (result.kind === 'refused' && result.error === 'not_deletable') {
      Alert.alert(
        'Could not delete',
        'A set can be deleted only after its chat or worktree is gone.'
      )
    }
    reload()
  }
  const actionsOf = (row: PrototypeListRow, host: RpcClient): ActionSheetAction[] => {
    // Why any set: once its chat is gone, a set is deleted without archiving it first.
    const deleteAction: ActionSheetAction[] =
      row.set.deletable === true
        ? [
            {
              label: 'Delete',
              destructive: true,
              // Why: iOS cannot show the confirmation while the sheet is still closing.
              closeBeforePress: true,
              onPress: () => confirmDelete(row, host)
            }
          ]
        : []
    if (row.set.archived !== true) {
      return [
        {
          label: 'Archive',
          icon: Archive,
          onPress: () => void run((target) => archiveMobilePrototypeRequest(host, target), row)
        },
        ...deleteAction
      ]
    }
    return [
      {
        label: 'Unarchive',
        icon: ArchiveRestore,
        onPress: () => void run((target) => unarchiveMobilePrototypeRequest(host, target), row)
      },
      ...deleteAction
    ]
  }
  const confirmDelete = (row: PrototypeListRow, host: RpcClient): void => {
    Alert.alert(
      'Delete this prototype set?',
      `This removes the files of "${row.title}" from your computer. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void run((target) => deleteMobilePrototypeRequest(host, target), row)
        }
      ]
    )
  }
  return {
    canAct: client !== null && !hostLacksArchive && hostMayArchivePrototypes(client),
    menuRow,
    menuActions: client === null || menuRow === null ? [] : actionsOf(menuRow, client),
    openMenu: setMenuRow,
    closeMenu: () => setMenuRow(null)
  }
}
