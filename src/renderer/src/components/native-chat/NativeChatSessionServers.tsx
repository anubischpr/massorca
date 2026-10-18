import { Copy, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import { browserUrlForPort, browserUrlForPortForwardEntry } from '@/lib/workspace-port-urls'
import { nativeChatSessionServers } from './native-chat-session-summary'
import { getRuntimeSshAccess } from '../../../../shared/runtime-environments'
import {
  SshPortForwardDialog,
  type PortForwardDialogState
} from '@/components/right-sidebar/ssh-port-forward-dialog'
import { NativeChatSessionSection } from './NativeChatSessionSection'

/** The QA servers this chat's workspace listens on; each keeps its open and copy routes. */
export function NativeChatSessionServers(props: {
  target: RuntimeClientTarget
  worktreeId: string | null
}): React.JSX.Element {
  const { t } = useTranslation()
  const scans = useAppStore((state) => state.workspacePortScansByKey)
  const environmentId = props.target.kind === 'environment' ? props.target.environmentId : null
  const environment = useAppStore((state) =>
    environmentId
      ? state.runtimeEnvironments.find((entry) => entry.id === environmentId)
      : undefined
  )
  const access = environment ? getRuntimeSshAccess(environment) : undefined
  const targetGeneration = useAppStore((state) =>
    access ? state.sshTargetGenerations.get(access.sshTargetId) : undefined
  )
  const connection = useAppStore((state) =>
    access ? state.sshConnectionStates.get(access.sshTargetId) : undefined
  )
  const forwards = useAppStore((state) =>
    access ? state.portForwardsByConnection[access.sshTargetId] : undefined
  )
  const canForward =
    access && targetGeneration === access.sshTargetGeneration && connection?.status === 'connected'
  const [dialog, setDialog] = useState<PortForwardDialogState>({ mode: 'closed' })
  const { scan, ports } = nativeChatSessionServers(scans, props.target, props.worktreeId)
  const [error, setError] = useState<string | null>(null)
  const title = t('components.nativeChatSummary.servers', 'QA servers')
  const unavailable = t('components.nativeChatSummary.unavailable', 'Unavailable')
  const urlFor = (port: (typeof ports)[number]): string | null => {
    if (props.target.kind === 'local') {
      return browserUrlForPort(port)
    }
    const forward = canForward
      ? forwards?.find(
          (entry) =>
            entry.remotePort === port.port &&
            ['localhost', '127.0.0.1', '::1'].includes(entry.remoteHost)
        )
      : undefined
    return forward
      ? browserUrlForPortForwardEntry({
          ...forward,
          advertisedProtocol: port.protocol === 'https' ? 'https' : 'http'
        })
      : null
  }
  const act = async (url: string, copy: boolean) => {
    setError(null)
    try {
      await (copy ? navigator.clipboard.writeText(url) : window.api.shell.openUrl(url))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }
  const scanMessage =
    scan?.unavailableReason ??
    t(
      'components.nativeChatSummary.serverUnavailable',
      'No port scan has been reported for this host.'
    )
  const hasScan = Boolean(scan) && !scan?.unavailableReason
  const firstPort = ports[0]
  const firstUrl = firstPort ? (urlFor(firstPort) ?? browserUrlForPort(firstPort)) : null
  const compact = !hasScan ? (
    <p>{scanMessage}</p>
  ) : firstUrl ? (
    <p className="truncate" title={firstUrl}>
      {firstUrl}
    </p>
  ) : (
    <p>{t('components.nativeChatSummary.noServers', 'No servers detected for this workspace.')}</p>
  )
  return (
    <NativeChatSessionSection
      title={title}
      summary={
        hasScan
          ? t('components.nativeChatSummary.detectedCount', '{{count}} detected', {
              count: ports.length
            })
          : unavailable
      }
      compact={compact}
    >
      <div className="space-y-3">
        <p className="text-muted-foreground">
          {t(
            'components.nativeChatSummary.serverEvidence',
            'Detected listeners attributed to this workspace on its execution host; application readiness is not verified.'
          )}
        </p>
        {!hasScan ? <p>{scanMessage}</p> : null}
        {hasScan && ports.length === 0 ? (
          <p>
            {t('components.nativeChatSummary.noServers', 'No servers detected for this workspace.')}
          </p>
        ) : null}
        {ports.map((port) => {
          const url = urlFor(port)
          return (
            <div key={port.id} className="space-y-2 break-words">
              <p>{url ?? browserUrlForPort(port)}</p>
              {url ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="xs" onClick={() => void act(url, true)}>
                    <Copy />
                    {t('components.nativeChatSummary.copy', 'Copy URL')}
                  </Button>
                  <Button variant="outline" size="xs" onClick={() => void act(url, false)}>
                    <ExternalLink />
                    {t('components.nativeChatSummary.openPc', 'Open on PC')}
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-muted-foreground">
                    {t(
                      'components.nativeChatSummary.remoteRouteUnavailable',
                      'A client-accessible route is required before this remote URL can be copied or opened on this PC.'
                    )}
                  </p>
                  {canForward ? (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() =>
                        setDialog({
                          mode: 'add',
                          defaults: {
                            targetId: access.sshTargetId,
                            remotePort: port.port,
                            remoteHost: '127.0.0.1',
                            label: port.processName
                          }
                        })
                      }
                    >
                      {t('components.nativeChatSummary.forward', 'Forward to PC')}
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          )
        })}
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : null}
        <SshPortForwardDialog
          state={dialog}
          activeConnectionId={canForward ? access.sshTargetId : null}
          onClose={() => setDialog({ mode: 'closed' })}
        />
      </div>
    </NativeChatSessionSection>
  )
}
