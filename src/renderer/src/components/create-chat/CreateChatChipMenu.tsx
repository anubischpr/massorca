import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  /** Shown in place of the items while there are none. */
  placeholder?: string
  /** True keeps the menu open after this value is picked, for a choice that has a next step. */
  keepOpenAfter?: (value: string) => boolean
  /** Items behind a collapsible row, listed after the group's own items. */
  folded?: CreateChatFoldedItems
}

export type CreateChatFoldedItems = {
  label: string
  open: boolean
  onToggle: () => void
  items: readonly CreateChatMenuItem[]
}

export type CreateChatChipTone = 'neutral' | 'warning' | 'accent'

type CreateChatChipMenuProps = {
  ariaLabel: string
  label: string
  icon: ReactNode
  tone?: CreateChatChipTone
  note?: string
  groups: readonly CreateChatMenuGroup[]
  /** Controlled open state, for a chip whose menu stays open across steps. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** The chip cannot open its menu, such as Workspace mode for a folder. */
  disabled?: boolean
}

// Why: <Button> owns its colour, so the tone sits on the inner span.
const TONE_CLASS: Record<CreateChatChipTone, string> = {
  neutral: 'text-muted-foreground',
  warning: 'text-status-warning',
  accent: 'bg-accent text-accent-foreground px-1'
}

type ChipMenuGroupValue = {
  openId: string | null
  opened: (id: string) => void
  closed: (id: string) => void
}

const ChipMenuGroupContext = createContext<ChipMenuGroupValue | null>(null)

/**
 * Chips under one group keep one menu open at a time. The popper of the menu that was open would
 * otherwise stay up beside the new one and re-measure when the new menu locks scrolling, which
 * is the resize and flip of the agent list when another chip is clicked.
 */
export function CreateChatChipMenuGroup({ children }: { children: ReactNode }): React.JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null)
  const opened = useCallback((id: string) => setOpenId(id), [])
  const closed = useCallback(
    (id: string) => setOpenId((current) => (current === id ? null : current)),
    []
  )
  const value = useMemo(() => ({ openId, opened, closed }), [closed, openId, opened])
  return <ChipMenuGroupContext.Provider value={value}>{children}</ChipMenuGroupContext.Provider>
}

/** A composer footer chip that opens a radio-style menu: one or more groups of described choices. */
export function CreateChatChipMenu({
  ariaLabel,
  label,
  icon,
  tone = 'neutral',
  note,
  groups,
  open,
  onOpenChange,
  disabled = false
}: CreateChatChipMenuProps): React.JSX.Element {
  const id = useId()
  const group = useContext(ChipMenuGroupContext)
  const controlled = open !== undefined
  const [innerOpen, setInnerOpen] = useState(false)
  // Why: set when another chip took over, so this menu leaves at once instead of animating out.
  const [displaced, setDisplaced] = useState(false)
  const isOpen = controlled ? open : innerOpen
  const setOpen = useCallback(
    (next: boolean): void => {
      if (!controlled) {
        setInnerOpen(next)
      }
      onOpenChange?.(next)
      if (next) {
        setDisplaced(false)
        group?.opened(id)
      } else {
        group?.closed(id)
      }
    },
    [controlled, group, id, onOpenChange]
  )
  const otherOpen = group !== null && group.openId !== null && group.openId !== id
  useLayoutEffect(() => {
    if (otherOpen && isOpen) {
      setDisplaced(true)
      setOpen(false)
    }
  }, [isOpen, otherOpen, setOpen])
  return (
    <DropdownMenu open={isOpen} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label={ariaLabel}
          disabled={disabled}
          className="max-w-48"
        >
          <span className={cn('flex min-w-0 items-center gap-1 rounded-sm', TONE_CLASS[tone])}>
            {icon}
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown className="size-3 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        collisionPadding={8}
        className="w-72"
        style={displaced ? { animation: 'none' } : undefined}
      >
        {note ? <div className="px-2 py-1.5 text-xs text-muted-foreground">{note}</div> : null}
        {groups.map((group, index) => (
          <Fragment key={group.key}>
            {index > 0 || note ? <DropdownMenuSeparator /> : null}
            {group.title ? <DropdownMenuLabel>{group.title}</DropdownMenuLabel> : null}
            {group.items.length === 0 && group.placeholder ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">{group.placeholder}</div>
            ) : null}
            <DropdownMenuRadioGroup value={group.value} onValueChange={group.onValueChange}>
              {renderChoiceItems(group, group.items)}
            </DropdownMenuRadioGroup>
            {group.folded ? <FoldedRows group={group} folded={group.folded} /> : null}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function renderChoiceItems(
  group: CreateChatMenuGroup,
  items: readonly CreateChatMenuItem[]
): React.JSX.Element[] {
  return items.map((item) => (
    <DropdownMenuRadioItem
      key={item.value}
      value={item.value}
      disabled={item.disabled}
      {...item.rowAttributes}
      onSelect={(event) => {
        // Why: Radix closes on select; the next step of the choice is in this same menu.
        if (group.keepOpenAfter?.(item.value)) {
          event.preventDefault()
        }
      }}
    >
      {item.icon}
      <NativeChatSessionOptionChoiceBody label={item.label} description={item.description} />
      {item.trailing ? (
        <span className="ml-auto pl-4 text-xs whitespace-nowrap text-muted-foreground">
          {item.trailing}
        </span>
      ) : null}
    </DropdownMenuRadioItem>
  ))
}

function FoldedRows({
  group,
  folded
}: {
  group: CreateChatMenuGroup
  folded: CreateChatFoldedItems
}): React.JSX.Element {
  return (
    <>
      <DropdownMenuItem
        aria-expanded={folded.open}
        onSelect={(event) => {
          // Why: the row expands in place; Radix would otherwise close the menu on select.
          event.preventDefault()
          folded.onToggle()
        }}
      >
        <ChevronRight
          className={cn('size-3 shrink-0 transition-transform', folded.open && 'rotate-90')}
        />
        {folded.label}
      </DropdownMenuItem>
      {folded.open ? (
        <DropdownMenuRadioGroup value={group.value} onValueChange={group.onValueChange}>
          {renderChoiceItems(group, folded.items)}
        </DropdownMenuRadioGroup>
      ) : null}
    </>
  )
}
