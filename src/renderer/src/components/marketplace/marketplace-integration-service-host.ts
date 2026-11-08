import { useCallback, useEffect, useRef, useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { MarketplaceCredentialStore } from '../../../../shared/marketplace-apps'
import type {
  MarketplaceServiceConnectArgs,
  MarketplaceServiceId,
  MarketplaceServiceStatus,
  MarketplaceServicesResult
} from '../../../../shared/marketplace-services'
import {
  connectServiceOnHost,
  disconnectServiceOnHost,
  readServicesOnHost
} from './marketplace-integration-host-client'
import { MARKETPLACE_INTEGRATIONS } from './marketplace-integrations'
import { vaultHostFailureMessage } from './marketplace-vault-credential-text'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import { marketplaceHostKey } from './use-marketplace-host-targets'

export type ServiceHostState =
  | { kind: 'loading' }
  | {
      kind: 'ready'
      hostLabel: string
      store: MarketplaceCredentialStore
      entry: MarketplaceServiceStatus
    }
  /** The host has no path for this service (a WSL distro, an SSH host): never this computer's data. */
  | { kind: 'not-on-host'; target: MarketplaceVaultHostTarget }
  | { kind: 'failed'; message: string }

export type ServiceActionOutcome = { ok: true } | { ok: false; message: string }

export type ServiceHost = {
  state: ServiceHostState
  /** Where the state came from: null is this computer. */
  target: MarketplaceVaultHostTarget | null
  hostLabel: string
  reload: () => void
  connect: (args: Omit<MarketplaceServiceConnectArgs, 'service'>) => Promise<ServiceActionOutcome>
  disconnect: () => Promise<ServiceActionOutcome>
}

function thisComputerLabel(): string {
  return translate(
    'auto.components.marketplace.MarketplaceAppHostPicker.thisComputer',
    'This computer'
  )
}

function failureMessage(
  result: Extract<MarketplaceServicesResult, { ok: false }>,
  service: MarketplaceServiceId,
  hostLabel: string
): string {
  switch (result.reason) {
    case 'rejected':
      return (
        result.message ??
        translate(
          'auto.components.marketplace.marketplace-integration-service-host.rejected',
          '{{app}} did not accept this token. Check it, then try again.',
          { app: MARKETPLACE_INTEGRATIONS[service].name }
        )
      )
    case 'unavailable-on-host':
      return translate(
        'auto.components.marketplace.marketplace-integration-service-host.unavailable',
        '{{app}} is not available on {{host}}.',
        { app: MARKETPLACE_INTEGRATIONS[service].name, host: hostLabel }
      )
    default:
      return vaultHostFailureMessage(result.reason, hostLabel)
  }
}

function stateFrom(
  result: MarketplaceServicesResult,
  service: MarketplaceServiceId,
  target: MarketplaceVaultHostTarget | null,
  hostLabel: string
): ServiceHostState {
  if (result.ok) {
    const entry = result.status.services.find((candidate) => candidate.service === service)
    return {
      kind: 'ready',
      hostLabel: result.status.hostLabel,
      store: result.status.store,
      entry: entry ?? { service, source: 'none' }
    }
  }
  if (result.reason === 'unavailable-on-host' && target !== null && target.kind !== 'runtime') {
    return { kind: 'not-on-host', target }
  }
  return { kind: 'failed', message: failureMessage(result, service, hostLabel) }
}

/**
 * One service as the picked host reports it, with the calls that change it on that same host.
 * A host just picked reads as loading, never as the previous host's answer.
 */
export function useMarketplaceServiceHost(
  service: MarketplaceServiceId,
  target: MarketplaceVaultHostTarget | null
): ServiceHost {
  const key = target === null ? 'local' : marketplaceHostKey(target)
  const hostLabel = target?.label ?? thisComputerLabel()
  const latest = useRef({ target, hostLabel })
  const generation = useRef(0)
  const [answer, setAnswer] = useState<{ key: string; state: ServiceHostState } | null>(null)

  useEffect(() => {
    latest.current = { target, hostLabel }
  }, [target, hostLabel])

  const apply = useCallback(
    (result: MarketplaceServicesResult, forKey: string, picked: typeof latest.current) => {
      setAnswer({
        key: forKey,
        state: stateFrom(result, service, picked.target, picked.hostLabel)
      })
    },
    [service]
  )

  const reload = useCallback(() => {
    const picked = latest.current
    const forKey = picked.target === null ? 'local' : marketplaceHostKey(picked.target)
    const current = ++generation.current
    void readServicesOnHost(picked.target).then((result) => {
      if (current === generation.current) {
        apply(result, forKey, picked)
      }
    })
  }, [apply])

  useEffect(() => {
    reload()
    return () => {
      generation.current += 1
    }
  }, [key, reload])

  const run = useCallback(
    async (
      call: (picked: MarketplaceVaultHostTarget | null) => Promise<MarketplaceServicesResult>
    ): Promise<ServiceActionOutcome> => {
      const picked = latest.current
      const forKey = picked.target === null ? 'local' : marketplaceHostKey(picked.target)
      const result = await call(picked.target)
      generation.current += 1
      if (result.ok) {
        apply(result, forKey, picked)
        return { ok: true }
      }
      return { ok: false, message: failureMessage(result, service, picked.hostLabel) }
    },
    [apply, service]
  )

  const connect = useCallback(
    (args: Omit<MarketplaceServiceConnectArgs, 'service'>) =>
      run((picked) => connectServiceOnHost(picked, { service, ...args })),
    [run, service]
  )
  const disconnect = useCallback(
    () => run((picked) => disconnectServiceOnHost(picked, { service })),
    [run, service]
  )

  return {
    state: answer !== null && answer.key === key ? answer.state : { kind: 'loading' },
    target,
    hostLabel,
    reload,
    connect,
    disconnect
  }
}
