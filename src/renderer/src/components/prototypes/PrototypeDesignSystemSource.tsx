import { Button } from '@/components/ui/button'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { buildDesignSystemRedetectMessage } from '../../../../shared/prototype-design-system-message'
import {
  designSystemDayLabel,
  joinParts,
  previousVersionOf
} from '../../../../shared/prototype-design-system-view'
import { designSystemStatusWord } from './prototype-design-system-labels'
import type { DesignSystemPanelProps } from './prototype-design-system-props'

/**
 * The Source tab: the files the system was detected from, its version line, and Re-detect, which asks the
 * project's agent to read the project again.
 */
export function PrototypeDesignSystemSource({
  system,
  content,
  state,
  target,
  runSend
}: DesignSystemPanelProps): React.JSX.Element {
  const locale = getIntlLocale()
  const previous = previousVersionOf(content.meta.history, system.version)
  const previousText =
    previous === null
      ? null
      : joinParts(
          [
            translate('components.prototypes.designSystem.previousVersion', 'v{{version}} was', {
              version: previous.version
            }),
            previous.status === undefined ? null : designSystemStatusWord(previous.status),
            designSystemDayLabel(previous.at, locale)
          ],
          ' '
        )
  const versionLine = joinParts([
    translate('components.prototypes.designSystem.versionLabel', 'v{{version}}', {
      version: system.version
    }),
    system.agent,
    designSystemDayLabel(content.meta.updatedAt, locale),
    previousText
  ])
  return (
    <div className="flex max-w-[760px] flex-col gap-2.5 px-6 py-5">
      {content.meta.sources.length === 0 ? null : (
        <>
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {translate('components.prototypes.designSystem.detectedFrom', 'Detected from')}
          </span>
          {content.meta.sources.map((source, index) => (
            <div
              key={`${index}:${source.path}`}
              className="flex flex-col gap-1 rounded-lg border border-border p-3"
            >
              <span className="font-mono text-xs">{source.path}</span>
              <span className="text-xs text-muted-foreground">{source.took}</span>
            </div>
          ))}
        </>
      )}
      <span className="text-xs text-muted-foreground">{versionLine}</span>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={target === undefined || state.sending}
        onClick={() => void runSend('redetect', buildDesignSystemRedetectMessage().sentText)}
      >
        {translate('components.prototypes.designSystem.redetect', 'Re-detect from project')}
      </Button>
      {state.failed === 'redetect' ? (
        <span role="alert" className="text-[11px] text-destructive">
          {translate(
            'components.prototypes.sendFailed',
            "Couldn't send: the chat is no longer active. Your draft is kept."
          )}
        </span>
      ) : null}
    </div>
  )
}
