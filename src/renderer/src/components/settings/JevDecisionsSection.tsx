import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { JevDecisionsStatus } from '../../../../shared/jev-decisions-status'
import {
  clearJevApiKey,
  getJevDecisionsStatus,
  saveJevApiKey,
  setRemoteJevDecisionsEnabled
} from '@/runtime/runtime-jev-decisions-client'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { UnsealedCredentialNotice } from './UnsealedCredentialNotice'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'

type JevDecisionsSectionProps = {
  target: RuntimeClientTarget
  /** The local setting; a connected server reports its own switch in its status. */
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
}

export function JevDecisionsSection({
  target,
  enabled,
  onEnabledChange
}: JevDecisionsSectionProps): React.JSX.Element {
  const [status, setStatus] = useState<JevDecisionsStatus | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [statusFailed, setStatusFailed] = useState(false)
  const remote = target.kind === 'environment'
  const environmentId = target.kind === 'environment' ? target.environmentId : null
  const latestEnvironmentId = useRef(environmentId)
  latestEnvironmentId.current = environmentId

  useEffect(() => {
    let current = true
    setStatus(null)
    setStatusFailed(false)
    setBusy(false)
    setKeyDraft('')
    void getJevDecisionsStatus(target).then(
      (next) => {
        if (current) {
          setStatus(next)
        }
      },
      () => {
        if (current) {
          setStatusFailed(true)
        }
      }
    )
    return () => {
      current = false
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `target` is a fresh object each render; its environment id is its identity.
  }, [environmentId])

  const updateKey = async (update: () => Promise<JevDecisionsStatus>): Promise<void> => {
    // Why: a reply from a server the window has since left must not overwrite the new server's state.
    const isStale = (): boolean => latestEnvironmentId.current !== environmentId
    setBusy(true)
    try {
      const next = await update()
      if (!isStale()) {
        setStatus(next)
        setKeyDraft('')
      }
    } catch (error) {
      toast.error(
        translate(
          'auto.components.settings.OrchestrationPane.jevUpdateFailed',
          'Jev API key update failed.'
        ),
        { description: error instanceof Error ? error.message : String(error) }
      )
    } finally {
      if (!isStale()) {
        setBusy(false)
      }
    }
  }

  const keyConfigured = status?.apiKeyConfigured === true
  const keyUnreadable = status?.apiKeyUnreadable === true
  const isOn = remote ? status?.enabled === true : enabled
  const changeEnabled = (next: boolean): void => {
    if (target.kind === 'environment') {
      void updateKey(() => setRemoteJevDecisionsEnabled(target, next))
    } else {
      onEnabledChange(next)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label>
            {translate('auto.components.settings.OrchestrationPane.jevTitle', 'Jev decisions')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.OrchestrationPane.jevDescription',
              'Let Jev by typesafe pick how demanding each delegated task is, for a small provider cost per task. Only the one-line task summary is sent to typesafe. If Jev is off, slow or failing, MassOrca decides on its own.'
            )}
          </p>
        </div>
        <Switch
          aria-label={translate(
            'auto.components.settings.OrchestrationPane.jevTitle',
            'Jev decisions'
          )}
          checked={isOn}
          // Why: a switch that is on without a key would do nothing and say nothing; off stays reachable.
          disabled={busy || (!isOn && (!keyConfigured || keyUnreadable))}
          onCheckedChange={changeEnabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="jev-api-key">
          {translate('auto.components.settings.OrchestrationPane.jevKeyLabel', 'typesafe API key')}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="jev-api-key"
            type="password"
            disabled={busy}
            value={keyDraft}
            onChange={(event) => setKeyDraft(event.target.value)}
            placeholder={translate(
              'auto.components.settings.OrchestrationPane.jevKeyPlaceholder',
              'Paste your typesafe API key'
            )}
            spellCheck={false}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={busy || keyDraft.trim().length === 0}
            onClick={() => void updateKey(() => saveJevApiKey(target, keyDraft))}
          >
            {translate('auto.components.settings.OrchestrationPane.jevSave', 'Save')}
          </Button>
          {keyConfigured ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                // Why: without a key the switch could not be turned on again, so it must not stay on.
                if (!remote) {
                  onEnabledChange(false)
                }
                void updateKey(() => clearJevApiKey(target))
              }}
            >
              {translate('auto.components.settings.OrchestrationPane.jevRemove', 'Remove')}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {statusFailed
            ? translate(
                'auto.components.settings.OrchestrationPane.jevStatusUnavailable',
                'Could not read Jev decisions from this server. Reopen Settings to retry; if it keeps failing, update the server.'
              )
            : keyUnreadable
              ? translate(
                  'auto.components.settings.OrchestrationPane.jevKeyUnreadable',
                  'The saved key cannot be read here, so MassOrca is deciding on its own. Paste it and save it again.'
                )
              : keyConfigured
                ? remote
                  ? translate(
                      'auto.components.settings.OrchestrationPane.jevKeySavedRemote',
                      'API key saved on the connected server. Its delegations use it.'
                    )
                  : translate(
                      'auto.components.settings.OrchestrationPane.jevKeySaved',
                      'API key saved on this computer, encrypted.'
                    )
                : translate(
                    'auto.components.settings.OrchestrationPane.jevKeyMissing',
                    'Save a key to turn this on.'
                  )}
        </p>
        <UnsealedCredentialNotice
          protection={status?.apiKeyProtection ?? null}
          credentialName={translate(
            'auto.components.settings.OrchestrationPane.jevKeyLabel',
            'typesafe API key'
          )}
        />
      </div>
    </div>
  )
}
