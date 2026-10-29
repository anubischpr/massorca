import type { GlobalSettings } from '../../../../shared/global-settings-types'
import {
  PROTOTYPE_COUNT_MAX,
  PROTOTYPE_COUNT_MIN,
  buildPrototypeAskCountLine,
  buildPrototypeCountLine,
  clampPrototypeCount,
  sanitizePrototypeCountSetting,
  type PrototypeCountSetting
} from '../../../../shared/prototype-count-setting'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

const COUNT_MODE_INPUT_NAME = 'prototype-count-mode'

export function PrototypesSettingsPane({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => Promise<void>
}): React.JSX.Element {
  const setting = sanitizePrototypeCountSetting(settings.prototypeCount)
  const save = (next: PrototypeCountSetting): void => {
    void updateSettings({ prototypeCount: next })
  }
  const step = (delta: number): void => {
    save({ ...setting, count: clampPrototypeCount(setting.count + delta) })
  }
  const promptLine =
    setting.mode === 'always'
      ? buildPrototypeCountLine(setting.count)
      : buildPrototypeAskCountLine()

  return (
    <div className="space-y-5">
      <fieldset className="space-y-3 rounded-lg border border-border p-3.5">
        <legend className="px-1.5 text-xs text-muted-foreground">
          {translate('components.prototypes.settings.alternatives', 'Alternatives per request')}
        </legend>
        <label className="flex items-start gap-2.5">
          <input
            type="radio"
            name={COUNT_MODE_INPUT_NAME}
            checked={setting.mode === 'always'}
            onChange={() => save({ ...setting, mode: 'always' })}
            className="mt-1"
          />
          <span className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              {translate('components.prototypes.settings.always', 'Always make')}
            </span>
            <span className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={translate('components.prototypes.settings.fewer', 'Fewer')}
                disabled={setting.count <= PROTOTYPE_COUNT_MIN}
                onClick={() => step(-1)}
              >
                −
              </Button>
              <span className="min-w-6 text-center text-sm font-semibold">{setting.count}</span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={translate('components.prototypes.settings.more', 'More')}
                disabled={setting.count >= PROTOTYPE_COUNT_MAX}
                onClick={() => step(1)}
              >
                +
              </Button>
              <span className="text-sm text-muted-foreground">
                {translate(
                  'components.prototypes.settings.directionsHint',
                  'directions (default 2, max 4)'
                )}
              </span>
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2.5">
          <input
            type="radio"
            name={COUNT_MODE_INPUT_NAME}
            checked={setting.mode === 'ask'}
            onChange={() => save({ ...setting, mode: 'ask' })}
            className="mt-1"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">
              {translate('components.prototypes.settings.ask', 'Ask each time')}
            </span>
            <span className="text-sm text-muted-foreground">
              {translate(
                'components.prototypes.settings.askDescription',
                'A card in the chat asks 1, 2 or 3 before the agent starts.'
              )}
            </span>
          </span>
        </label>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {translate(
            'components.prototypes.settings.addsHeading',
            'What MassOrca adds to your prompt'
          )}
        </span>
        <div
          data-prototype-prompt-line="true"
          className="rounded-lg border border-border bg-muted/40 p-2.5 font-mono text-xs leading-relaxed text-foreground"
        >
          {promptLine}
        </div>
        <span className="text-sm leading-normal text-muted-foreground">
          {translate(
            'components.prototypes.settings.addsNote',
            'Works the same for Claude, Codex, Antigravity and Gentle Shell: it is plain text in the message. The results are grouped as one set per request.'
          )}
        </span>
      </div>
    </div>
  )
}
