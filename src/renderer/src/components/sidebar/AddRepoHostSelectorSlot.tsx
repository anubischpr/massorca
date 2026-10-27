import { useState } from 'react'
import { AddRepoGhAccountPicker } from './AddRepoGhAccountPicker'
import type { useAddRepoGhAccount } from './use-add-repo-gh-account'
import { AddRepoHostSelector } from './AddRepoHostSelector'
import type { useAddRepoHostSelection } from './use-add-repo-host-selection'
import { AddRemoteHostDialog, type AddRemoteHostMode } from './AddRemoteHostDialog'

export function AddRepoHostSelectorSlot({
  hostSelection,
  ghAccount
}: {
  hostSelection: ReturnType<typeof useAddRepoHostSelection>
  /** GitHub account for the new project, shown under the host picker. */
  ghAccount?: ReturnType<typeof useAddRepoGhAccount>
}) {
  const [addRemoteHostMode, setAddRemoteHostMode] = useState<AddRemoteHostMode | null>(null)

  return (
    <>
      <AddRepoHostSelector
        hosts={hostSelection.hostOptions}
        selectedHostId={hostSelection.displayedHostId}
        open={hostSelection.hostSelectorOpen}
        onOpenChange={hostSelection.setHostSelectorOpen}
        onSelectHost={(hostId) => void hostSelection.handleSelectAddProjectHost(hostId)}
        onConnectHost={(hostId) => void hostSelection.handleConnectAddProjectHost(hostId)}
        onAddSshHost={() => setAddRemoteHostMode('ssh')}
        onAddRemoteServer={() => setAddRemoteHostMode('server')}
      />
      {ghAccount ? <AddRepoGhAccountPicker ghAccount={ghAccount} /> : null}
      <AddRemoteHostDialog mode={addRemoteHostMode} onOpenChange={setAddRemoteHostMode} />
    </>
  )
}
