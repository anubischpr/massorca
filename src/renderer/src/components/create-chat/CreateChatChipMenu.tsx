import { Fragment, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { NativeChatSessionOptionChoiceBody } from '../native-chat/NativeChatSessionOptionChoiceBody'
import type { CreateChatMenuItem } from './create-chat-menu-items'

export type CreateChatMenuGroup = {
  key: string
  title?: string
  value: string
  items: readonly CreateChatMenuItem[]
  onValueChange: (value: string) => void
}

export type CreateChatChipTone = 'neutral' | 'warning' | 'accent'

type CreateChatChipMenuProps = {
  ariaLabel: string
  label: string
  icon: ReactNode
  tone?: CreateChatChipTone
  note?: string
  groups: readonly CreateChatMenuGroup[]
}

// Why: <Button> owns its colour, so the tone sits on the inner span.
const TONE_CLASS: Record<CreateChatChipTone, string> = {
  neutral: 'text-muted-foreground',
  warning: 'text-status-warning',
  accent: 'bg-accent text-accent-foreground px-1'
}

/** A composer footer chip that opens a radio-style menu: one or more groups of described choices. */
export function CreateChatChipMenu({
  ariaLabel,
  label,
  icon,
  tone = 'neutral',
  note,
  groups
}: CreateChatChipMenuProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="xs" aria-label={ariaLabel} className="max-w-48">
          <span className={cn('flex min-w-0 items-center gap-1 rounded-sm', TONE_CLASS[tone])}>
            {icon}
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown className="size-3 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" collisionPadding={8} className="w-72">
        {note ? <div className="px-2 py-1.5 text-xs text-muted-foreground">{note}</div> : null}
        {groups.map((group, index) => (
          <Fragment key={group.key}>
            {index > 0 || note ? <DropdownMenuSeparator /> : null}
            {group.title ? <DropdownMenuLabel>{group.title}</DropdownMenuLabel> : null}
            <DropdownMenuRadioGroup value={group.value} onValueChange={group.onValueChange}>
              {group.items.map((item) => (
                <DropdownMenuRadioItem key={item.value} value={item.value} disabled={item.disabled}>
                  <NativeChatSessionOptionChoiceBody
                    label={item.label}
                    description={item.description}
                  />
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
