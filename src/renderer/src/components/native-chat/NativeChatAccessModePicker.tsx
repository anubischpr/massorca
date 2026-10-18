import { ChevronDown, Shield, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type {
  SessionOptionDescriptor,
  SessionOptionValue
} from '../../../../shared/native-chat-session-options'
import { nativeChatAccessTone, type NativeChatAccessTone } from './native-chat-access-mode-tone'
import {
  nativeChatSessionChoiceLabel,
  nativeChatSessionOptionDisabledReason,
  nativeChatSessionOptionNote
} from './native-chat-session-option-labels'
import { NativeChatSessionOptionChoiceBody } from './NativeChatSessionOptionChoiceBody'
import { useNativeChatPickerFocusReturn } from './native-chat-picker-focus-return'

const ACCESS_ICON: Record<NativeChatAccessTone, LucideIcon> = {
  warning: ShieldAlert,
  success: ShieldCheck,
  neutral: Shield
}

export type NativeChatAccessModePickerProps = {
  descriptor: SessionOptionDescriptor
  /** The chat is busy or another pick is in flight. */
  busy: boolean
  onSelect: (value: SessionOptionValue) => void
  focusComposer?: () => void
}

/** The access control beside the model: a shield whose colour names the risk of the mode it runs in. */
export function NativeChatAccessModePicker({
  descriptor,
  busy,
  onSelect,
  focusComposer
}: NativeChatAccessModePickerProps): React.JSX.Element | null {
  const focus = useNativeChatPickerFocusReturn(focusComposer)
  if (descriptor.kind.type !== 'select') {
    return null
  }
  const { choices } = descriptor.kind
  const current = descriptor.kind.currentValue ?? 'inherit'
  const tone = nativeChatAccessTone(current, descriptor.inheritedAccess)
  const Icon = ACCESS_ICON[tone]
  const category = translate('components.native-chat.composer.accessMode', 'Access')
  const valueLabel = nativeChatSessionChoiceLabel(
    choices.find((choice) => choice.value === current) ?? { value: current, label: current }
  )
  const reason = nativeChatSessionOptionDisabledReason(descriptor.disabledReason)
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild disabled={busy}>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-label={translate(
                'components.native-chat.composer.pillAccessibleName',
                '{{value0}} {{value1}}',
                { value0: category, value1: valueLabel }
              )}
              className="max-w-48"
            >
              <span
                className={cn(
                  'flex min-w-0 items-center gap-1',
                  tone === 'warning' && 'text-status-warning',
                  tone === 'success' && 'text-status-success'
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{valueLabel}</span>
              </span>
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {reason ?? category}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        side="top"
        collisionPadding={8}
        className="w-64"
        onCloseAutoFocus={focus.onCloseAutoFocus}
      >
        {descriptor.note ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {nativeChatSessionOptionNote(descriptor.note)}
          </div>
        ) : null}
        {reason && !descriptor.settable ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">{reason}</div>
        ) : null}
        <DropdownMenuRadioGroup
          aria-label={category}
          value={current}
          onValueChange={(value) => {
            focus.notePick()
            onSelect(value)
          }}
        >
          {choices.map((choice) => (
            <DropdownMenuRadioItem
              key={choice.value}
              value={choice.value}
              disabled={!descriptor.settable || busy || choice.disabled === true}
            >
              <NativeChatSessionOptionChoiceBody
                label={nativeChatSessionChoiceLabel(choice)}
                description={choice.description}
              />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
