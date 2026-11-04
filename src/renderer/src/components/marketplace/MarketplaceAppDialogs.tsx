import { translate } from '@/i18n/i18n'
import type { MarketplaceAppContext, MarketplaceAppDialog } from './marketplace-app-context'
import { MarketplaceFormDialog, useFormSubmit } from './MarketplaceFormDialog'
import {
  EngramServerDialog,
  OpenMetadataConnectDialog,
  OpenMetadataProfileDialog,
  OpenMetadataTokenDialog
} from './MarketplaceServerDialogs'

/** Opens the one dialog the page asks for; each dialog reports its own failure. */
export function MarketplaceAppDialogs({
  ctx,
  dialog,
  onClose
}: {
  ctx: MarketplaceAppContext
  dialog: MarketplaceAppDialog | null
  onClose: () => void
}): React.JSX.Element | null {
  if (!dialog) {
    return null
  }
  switch (dialog.kind) {
    case 'openmetadata-connect':
      return <OpenMetadataConnectDialog run={ctx.run} onClose={onClose} hostLabel={ctx.hostLabel} />
    case 'openmetadata-token':
      return <OpenMetadataTokenDialog run={ctx.run} onClose={onClose} />
    case 'openmetadata-profile':
      return <OpenMetadataProfileDialog profile={dialog.profile} run={ctx.run} onClose={onClose} />
    case 'engram-server':
      return (
        <EngramServerDialog
          serverUrl={ctx.status.serverUrl ?? null}
          run={ctx.run}
          onClose={onClose}
          hostLabel={ctx.hostLabel}
        />
      )
    case 'disconnect':
      return <DisconnectDialog ctx={ctx} onClose={onClose} />
  }
}

function DisconnectDialog({
  ctx,
  onClose
}: {
  ctx: MarketplaceAppContext
  onClose: () => void
}): React.JSX.Element {
  const form = useFormSubmit(ctx.run, onClose)
  const { appId, info } = ctx
  return (
    <MarketplaceFormDialog
      title={translate(
        'auto.components.marketplace.MarketplaceAppDialogs.disconnectTitle',
        'Disconnect {{app}}?',
        { app: info.name }
      )}
      description={
        appId === 'github'
          ? translate(
              'auto.components.marketplace.MarketplaceAppDialogs.githubDescription',
              'This does not sign you out of the GitHub CLI (gh). It only hides GitHub from agents on this computer.'
            )
          : ctx.hostLabel
            ? translate(
                'auto.components.marketplace.MarketplaceAppDialogs.descriptionHost',
                'Removes {{app}} from the agents on {{host}} and deletes the credentials stored there. You can connect it again later.',
                { app: info.name, host: ctx.hostLabel }
              )
            : translate(
                'auto.components.marketplace.MarketplaceAppDialogs.description',
                'Removes {{app}} and its skills from MassOrca on this computer. You can connect it again later.',
                { app: info.name }
              )
      }
      submitLabel={translate(
        'auto.components.marketplace.MarketplaceAppDialogs.disconnect',
        'Disconnect'
      )}
      destructive
      pending={form.pending}
      error={form.error}
      onSubmit={() => void form.submit((api) => api.disconnect({ id: appId }))}
      onClose={onClose}
    />
  )
}
