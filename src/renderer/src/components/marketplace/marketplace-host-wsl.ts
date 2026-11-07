import { useEffect, useMemo, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { isWebClientLocation } from '@/lib/web-client-location'
import { useLocalWindowsTerminalCapabilities } from '@/lib/windows-terminal-capabilities'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

export type MarketplaceWslTarget = Extract<MarketplaceVaultHostTarget, { kind: 'wsl' }>

/** What the renderer runs in: its user agent, and whether a paired web client is serving it. */
export type RendererClient = { userAgent: string; webClient: boolean }

/** Only the Windows desktop app can reach WSL distros, so only it lists them. */
export function isWindowsDesktopClient(client: RendererClient): boolean {
  return client.userAgent.includes('Windows') && !client.webClient
}

/** Each distro as a Marketplace host labelled WSL: <distro>; none unless this is the Windows desktop app. */
export function marketplaceWslTargetsFor(
  isWindowsDesktop: boolean,
  distros: readonly string[]
): MarketplaceWslTarget[] {
  if (!isWindowsDesktop) {
    return []
  }
  return distros.map((distro) => ({
    kind: 'wsl',
    distro,
    label: translate('auto.components.marketplace.MarketplaceAgentPage.wslHost', 'WSL: {{name}}', {
      name: distro
    })
  }))
}

/** The WSL distros of the Windows desktop app, from the same probe the Windows terminal reads. */
export function useMarketplaceWslTargets(): MarketplaceWslTarget[] {
  const isWindowsDesktop =
    typeof navigator !== 'undefined' &&
    isWindowsDesktopClient({ userAgent: navigator.userAgent, webClient: isWebClientLocation() })
  const { wslDistros } = useLocalWindowsTerminalCapabilities(isWindowsDesktop)
  return useMemo(
    () => marketplaceWslTargetsFor(isWindowsDesktop, wslDistros),
    [isWindowsDesktop, wslDistros]
  )
}

/** The agent commands on one distro's PATH; rejects when the distro cannot be probed. */
export function detectWslAgents(distro: string): Promise<readonly string[]> {
  return Promise.resolve().then(() => window.api.preflight.detectAgents({ wslDistro: distro }))
}

export type WslAgentDetection = {
  /** Null while the probe runs, and when it failed. */
  detectedIds: readonly string[] | null
  detectionFailed: boolean
}

/**
 * One distro's agent detection. Why: the skills detection hook stays null after a failed probe,
 * which would read as checking forever; here a failure is reported as one.
 */
export function useWslAgentDetection(distro: string | null): WslAgentDetection {
  const [answer, setAnswer] = useState<{ distro: string; ids: readonly string[] | null } | null>(
    null
  )
  useEffect(() => {
    if (distro === null) {
      return undefined
    }
    let current = true
    void detectWslAgents(distro).then(
      (ids) => {
        if (current) {
          setAnswer({ distro, ids })
        }
      },
      () => {
        if (current) {
          setAnswer({ distro, ids: null })
        }
      }
    )
    return () => {
      current = false
    }
  }, [distro])
  // Why: an answer for another distro, or none yet, reads as checking.
  if (distro === null || answer === null || answer.distro !== distro) {
    return { detectedIds: null, detectionFailed: false }
  }
  return { detectedIds: answer.ids, detectionFailed: answer.ids === null }
}
