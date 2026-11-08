import { translate } from '@/i18n/i18n'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import type { MarketplaceStatusTone } from './MarketplaceDetail'

/** A host the agent page can show: This computer, a paired server, an SSH host or a WSL distro, as the Marketplace picker lists them. */
export type MarketplaceAgentHost =
  | { kind: 'local' }
  | { kind: 'runtime'; environmentId: string; label: string }
  | { kind: 'ssh'; connectionId: string; label: string }
  | { kind: 'wsl'; distro: string; label: string }

/** What detection says about one agent on one host; `unverifiable` is a probe that never answered. */
export type MarketplaceAgentDetection = 'checking' | 'found' | 'missing' | 'unverifiable'

export type MarketplaceAgentHostAction = 'manage' | 'install'

export type MarketplaceAgentHostView = {
  state: string
  badge: { label: string; tone: MarketplaceStatusTone } | null
  action: MarketplaceAgentHostAction | null
}

/** The host the shared Marketplace picker points at; This computer when nothing is picked. */
export function marketplaceAgentHostFromTarget(
  target: MarketplaceVaultHostTarget | null
): MarketplaceAgentHost {
  if (target === null) {
    return { kind: 'local' }
  }
  switch (target.kind) {
    case 'ssh':
      return { kind: 'ssh', connectionId: target.connectionId, label: target.label }
    case 'wsl':
      return { kind: 'wsl', distro: target.distro, label: target.label }
    case 'runtime':
      return { kind: 'runtime', environmentId: target.environmentId, label: target.label }
  }
}

export function marketplaceAgentHostKey(host: MarketplaceAgentHost): string {
  switch (host.kind) {
    case 'local':
      return 'local'
    case 'runtime':
      return `runtime:${host.environmentId}`
    case 'ssh':
      return `ssh:${host.connectionId}`
    case 'wsl':
      return `wsl:${host.distro}`
  }
}

export function marketplaceAgentHostLabel(host: MarketplaceAgentHost): string {
  switch (host.kind) {
    case 'local':
      return translate(
        'auto.components.marketplace.MarketplaceAgentPage.thisComputer',
        'This computer'
      )
    case 'runtime':
    case 'wsl':
      return host.label
    case 'ssh':
      return translate(
        'auto.components.marketplace.MarketplaceAgentPage.sshHost',
        'SSH: {{name}}',
        {
          name: host.label
        }
      )
  }
}

/** Row copy, badge and action for one host. Detection only proves the command is on that host's PATH. */
export function marketplaceAgentHostView(
  detection: MarketplaceAgentDetection
): MarketplaceAgentHostView {
  switch (detection) {
    case 'checking':
      return {
        state: translate('auto.components.marketplace.MarketplaceAgentPage.checking', 'Checking…'),
        badge: null,
        action: null
      }
    case 'unverifiable':
      return {
        state: translate(
          'auto.components.marketplace.MarketplaceStatusBadge.unknown',
          'Could not check'
        ),
        badge: null,
        action: null
      }
    case 'found':
      return {
        state: translate(
          'auto.components.marketplace.MarketplaceAgentPage.installedByYou',
          'Installed by you.'
        ),
        badge: {
          label: translate(
            'auto.components.marketplace.MarketplaceAgentPage.foundWorks',
            'Found, works'
          ),
          tone: 'ok'
        },
        action: 'manage'
      }
    case 'missing':
      return {
        state: translate(
          'auto.components.marketplace.MarketplaceAgentPage.notInstalled',
          'Not installed'
        ),
        badge: {
          label: translate('auto.components.marketplace.MarketplaceAgentPage.missing', 'Missing'),
          tone: 'pending'
        },
        action: 'install'
      }
  }
}

export function marketplaceAgentHostActionLabel(action: MarketplaceAgentHostAction): string {
  return action === 'manage'
    ? translate('auto.components.marketplace.MarketplaceAgentPage.manage', 'Manage with MassOrca')
    : translate('auto.components.marketplace.MarketplaceAgentPage.install', 'Install')
}

/** The header status line for the picked host, worded the way the skill page words its host. */
export function marketplaceAgentHostStatus(
  hostName: string,
  detection: MarketplaceAgentDetection
): { text: string; tone: MarketplaceStatusTone } {
  switch (detection) {
    case 'found':
      return {
        text: translate(
          'auto.components.marketplace.MarketplaceAgentPage.installedOn',
          'Installed on {{host}}',
          { host: hostName }
        ),
        tone: 'ok'
      }
    case 'missing':
      return {
        text: translate(
          'auto.components.marketplace.MarketplaceAgentPage.notInstalledOn',
          'Not installed on {{host}}',
          { host: hostName }
        ),
        tone: 'pending'
      }
    case 'checking':
      return {
        text: translate(
          'auto.components.marketplace.MarketplaceAgentPage.checkingOn',
          'Checking {{host}}…',
          { host: hostName }
        ),
        tone: 'pending'
      }
    case 'unverifiable':
      return {
        text: translate(
          'auto.components.marketplace.MarketplaceAgentPage.couldNotCheckOn',
          'Could not check {{host}}',
          { host: hostName }
        ),
        tone: 'pending'
      }
  }
}
