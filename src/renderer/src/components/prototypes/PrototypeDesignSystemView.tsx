import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { translate } from '@/i18n/i18n'
import { DESIGN_SYSTEM_TOKENS_PATH } from '../../../../shared/prototype-design-system-files'
import { joinParts, sourceCountOf } from '../../../../shared/prototype-design-system-view'
import { isDesignSystemTab } from '../../../../shared/prototype-design-system-view-state'
import { designSystemStatusWord, fromSourcesLabel } from './prototype-design-system-labels'
import type { DesignSystemPanelProps } from './prototype-design-system-props'
import { PrototypeDesignSystemComponents } from './PrototypeDesignSystemComponents'
import { PrototypeDesignSystemSource } from './PrototypeDesignSystemSource'
import { PrototypeDesignSystemTokens } from './PrototypeDesignSystemTokens'
import { PrototypeDesignSystemVersionBanner } from './PrototypeDesignSystemVersionBanner'

/** The Versions button and the earlier version on screen; absent when the host lists no versions. */
export type DesignSystemVersionsControls = {
  /** The aside shows the Versions list. */
  panelOpen: boolean
  onToggle: () => void
  /** The earlier version on screen, read-only; null while the current one is. */
  preview: number | null
  /** The version a restore makes: the one after the current. */
  nextVersion: number
  onBackToCurrent: () => void
  onRestorePreview: () => void
}

/** One system's view: its header, the Tokens, Components and Source tabs, and the open tab's content. */
export function PrototypeDesignSystemView(
  props: DesignSystemPanelProps & { versions?: DesignSystemVersionsControls }
): React.JSX.Element {
  const { system, content, state, update, versions } = props
  const preview = versions?.preview ?? null
  const sources = sourceCountOf(content.meta)
  const subtitle = joinParts([
    DESIGN_SYSTEM_TOKENS_PATH,
    translate('components.prototypes.designSystem.versionLabel', 'v{{version}}', {
      version: system.version
    }),
    joinParts(
      [
        designSystemStatusWord(system.status),
        system.agent === undefined
          ? null
          : translate('components.prototypes.designSystem.byAgent', 'by {{agent}}', {
              agent: system.agent
            }),
        sources === 0 ? null : fromSourcesLabel(sources)
      ],
      ' '
    )
  ])
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-2.5">
        <div className="mr-auto flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold">
            {translate('components.prototypes.designSystem.title', 'Design system · {{project}}', {
              project: system.projectName
            })}
          </span>
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={state.tab}
            onValueChange={(value) => {
              if (isDesignSystemTab(value)) {
                update((latest) => ({ ...latest, tab: value }))
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="tokens">
                {translate('components.prototypes.designSystem.tabTokens', 'Tokens')}
              </TabsTrigger>
              <TabsTrigger value="components">
                {translate('components.prototypes.designSystem.tabComponents', 'Components')}
              </TabsTrigger>
              <TabsTrigger value="source">
                {translate('components.prototypes.designSystem.tabSource', 'Source')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {versions === undefined ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={versions.panelOpen}
              onClick={versions.onToggle}
            >
              <RotateCcw className="size-3.5" />
              {translate('components.prototypes.designSystem.versionsButton', 'Versions')}
            </Button>
          )}
        </div>
      </div>
      {versions === undefined || preview === null ? null : (
        <PrototypeDesignSystemVersionBanner
          version={preview}
          nextVersion={versions.nextVersion}
          onBackToCurrent={versions.onBackToCurrent}
          onRestore={versions.onRestorePreview}
        />
      )}
      {/* Why inert: an earlier version is read-only, so its tokens and components take no edits or picks. */}
      <div
        className="scrollbar-sleek flex min-h-0 flex-1 flex-col overflow-y-auto"
        inert={preview !== null}
      >
        {state.tab === 'tokens' ? <PrototypeDesignSystemTokens {...props} /> : null}
        {state.tab === 'components' ? <PrototypeDesignSystemComponents {...props} /> : null}
        {state.tab === 'source' ? <PrototypeDesignSystemSource {...props} /> : null}
      </div>
    </div>
  )
}
