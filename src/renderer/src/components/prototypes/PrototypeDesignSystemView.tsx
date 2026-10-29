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

/** One system's view: its header, the Tokens, Components and Source tabs, and the open tab's content. */
export function PrototypeDesignSystemView(props: DesignSystemPanelProps): React.JSX.Element {
  const { system, content, state, update } = props
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
      </div>
      <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col overflow-y-auto">
        {state.tab === 'tokens' ? <PrototypeDesignSystemTokens {...props} /> : null}
        {state.tab === 'components' ? <PrototypeDesignSystemComponents {...props} /> : null}
        {state.tab === 'source' ? <PrototypeDesignSystemSource {...props} /> : null}
      </div>
    </div>
  )
}
