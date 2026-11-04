import { translate } from '@/i18n/i18n'
import type { MarketplaceStatusTone } from './MarketplaceDetail'

/** A host that can run agents, as the agent page lists it. */
export type MarketplaceAgentHost =
  | { kind: 'local' }
  | { kind: 'runtime'; environmentId: string; label: string }
  | { kind: 'wsl'; distro: string }
  | { kind: 'ssh'; connectionId: string; label: string }

/** What detection says about one agent on one host; `unverifiable` is a probe that never answered. */
export type MarketplaceAgentDetection = 'checking' | 'found' | 'missing' | 'unverifiable'

export type MarketplaceAgentHostAction = 'manage' | 'install'

export type MarketplaceAgentHostView = {
  state: string
  badge: { label: string; tone: MarketplaceStatusTone } | null
  action: MarketplaceAgentHostAction | null
}

export function marketplaceAgentHostKey(host: MarketplaceAgentHost): string {
  switch (host.kind) {
    case 'local':
      return 'local'
    case 'runtime':
      return `runtime:${host.environmentId}`
    case 'wsl':
      return `wsl:${host.distro}`
    case 'ssh':
      return `ssh:${host.connectionId}`
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
      return host.label
    case 'wsl':
      return translate(
        'auto.components.marketplace.MarketplaceAgentPage.wslHost',
        'WSL: {{name}}',
        {
          name: host.distro
        }
      )
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

/** "On N of M hosts · works on K"; hosts still being checked count toward M only. */
export function marketplaceAgentHostsSummary(detections: readonly MarketplaceAgentDetection[]): {
  text: string
  tone: MarketplaceStatusTone
} {
  const on = detections.filter((detection) => detection === 'found').length
  return {
    text: translate(
      'auto.components.marketplace.MarketplaceAgentPage.summary',
      'On {{on}} of {{total}} hosts · works on {{works}}',
      { on: String(on), total: String(detections.length), works: String(on) }
    ),
    tone: on > 0 ? 'ok' : 'pending'
  }
}
