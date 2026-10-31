import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { JevDecisionsStatus } from '../../../../shared/jev-decisions-status'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'

type JevDecisionsSectionProps = {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
}

export function JevDecisionsSection({
  enabled,
  onEnabledChange
}: JevDecisionsSectionProps): React.JSX.Element {
  const [status, setStatus] = useState<JevDecisionsStatus | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let current = true
    void window.api.jevDecisions.getStatus().then(
      (next) => {
        if (current) {
          setStatus(next)
        }
      },
      () => undefined
    )
    return () => {
      current = false
    }
  }, [])

  const updateKey = async (update: () => Promise<JevDecisionsStatus>): Promise<void> => {
    setBusy(true)
    try {
      setStatus(await update())
      setKeyDraft('')
    } catch (error) {
      toast.error(
        translate(
          'auto.components.settings.OrchestrationPane.jevUpdateFailed',
          'Jev API key update failed.'
        ),
        { description: error instanceof Error ? error.message : String(error) }
      )
    } finally {
      setBusy(false)
    }
  }

  const keyConfigured = status?.apiKeyConfigured === true

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
          checked={enabled}
          // Why: a switch that is on without a key would do nothing and say nothing; off stays reachable.
          disabled={!enabled && !keyConfigured}
          onCheckedChange={onEnabledChange}
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
            onClick={() => void updateKey(() => window.api.jevDecisions.saveApiKey(keyDraft))}
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
                onEnabledChange(false)
                void updateKey(() => window.api.jevDecisions.clearApiKey())
              }}
            >
              {translate('auto.components.settings.OrchestrationPane.jevRemove', 'Remove')}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {keyConfigured
            ? translate(
                'auto.components.settings.OrchestrationPane.jevKeySaved',
                'API key saved on this computer, encrypted.'
              )
            : translate(
                'auto.components.settings.OrchestrationPane.jevKeyMissing',
                'Save a key to turn this on.'
              )}
        </p>
      </div>
    </div>
  )
}
