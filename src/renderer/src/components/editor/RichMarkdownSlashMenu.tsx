import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { runSlashCommand } from './rich-markdown-slash-commands'
import type { SlashCommand, SlashMenuState } from './rich-markdown-slash-commands'
import { translate } from '@/i18n/i18n'

const SLASH_MENU_GAP_PX = 8
const SLASH_MENU_CARET_LINE_PX = 24
const SLASH_MENU_VIEWPORT_MARGIN_PX = 12

type SlashMenuBox = { width: number; height: number }

/** Viewport position of a portaled menu: under the caret, or above it when the window has no room below. */
function resolvePortaledSlashMenuPosition(
  slashMenu: SlashMenuState,
  anchorRect: DOMRect | null,
  box: SlashMenuBox
): React.CSSProperties {
  if (anchorRect === null) {
    return { position: 'fixed', left: slashMenu.left, top: slashMenu.top }
  }
  const margin = SLASH_MENU_VIEWPORT_MARGIN_PX
  // Why: slashMenu.top is the caret bottom plus the gap, both relative to the editor root.
  const caretBottom = anchorRect.top + slashMenu.top - SLASH_MENU_GAP_PX
  const caretTop = caretBottom - SLASH_MENU_CARET_LINE_PX
  const belowTop = caretBottom + SLASH_MENU_GAP_PX
  const aboveTop = caretTop - SLASH_MENU_GAP_PX - box.height
  const fitsBelow = belowTop + box.height <= window.innerHeight - margin
  const fitsAbove = aboveTop >= margin
  const top = !fitsBelow && fitsAbove ? aboveTop : belowTop
  const maxLeft = Math.max(margin, window.innerWidth - box.width - margin)
  return {
    position: 'fixed',
    // Why: a body layer must clear the workbench panes, as the link bubble's z-index does.
    zIndex: 60,
    left: Math.min(Math.max(anchorRect.left + slashMenu.left, margin), maxLeft),
    top: Math.max(margin, Math.min(top, window.innerHeight - box.height - margin))
  }
}

type RichMarkdownSlashMenuProps = {
  editor: Editor | null
  slashMenu: SlashMenuState
  filteredCommands: SlashCommand[]
  selectedIndex: number
  onImagePick: () => void
  onEmojiPick: () => void
  /** Renders in a body-level layer so no clipping editor box can cut it off. */
  portalToDocument?: boolean
  /** The editor root that `slashMenu` offsets are measured from; needed when portaled. */
  anchorElement?: HTMLElement | null
}

export function RichMarkdownSlashMenu({
  editor,
  slashMenu,
  filteredCommands,
  selectedIndex,
  onImagePick,
  onEmojiPick,
  portalToDocument = false,
  anchorElement = null
}: RichMarkdownSlashMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [box, setBox] = useState<SlashMenuBox>({ width: 0, height: 0 })
  const [, setViewportVersion] = useState(0)
  let currentGroup: SlashCommand['group'] | null = null

  // Why: the menu's size follows its items, so it measures again when they change, before paint.
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!portalToDocument || !menu) {
      return
    }
    const { offsetWidth: width, offsetHeight: height } = menu
    setBox((current) =>
      current.width === width && current.height === height ? current : { width, height }
    )
  }, [portalToDocument, slashMenu, filteredCommands])

  useEffect(() => {
    if (!portalToDocument) {
      return
    }
    // Why: the menu is fixed to the viewport, so it follows the caret when the page scrolls.
    const refresh = (): void => setViewportVersion((version) => version + 1)
    window.addEventListener('scroll', refresh, true)
    window.addEventListener('resize', refresh)
    return () => {
      window.removeEventListener('scroll', refresh, true)
      window.removeEventListener('resize', refresh)
    }
  }, [portalToDocument])

  const style: React.CSSProperties = portalToDocument
    ? resolvePortaledSlashMenuPosition(
        slashMenu,
        anchorElement?.getBoundingClientRect() ?? null,
        box
      )
    : { left: slashMenu.left, top: slashMenu.top }

  const menu = (
    <div
      ref={menuRef}
      className="rich-markdown-slash-menu"
      style={style}
      role="dialog"
      aria-label={translate(
        'auto.components.editor.RichMarkdownSlashMenu.2e0400b958',
        'Slash commands'
      )}
    >
      <div className="rich-markdown-slash-search" onMouseDown={(event) => event.preventDefault()}>
        <Search className="size-3.5" />
        <input
          aria-label={translate(
            'auto.components.editor.RichMarkdownSlashMenu.550189b06c',
            'Search blocks'
          )}
          readOnly
          type="text"
          value={slashMenu.query}
          placeholder={translate(
            'auto.components.editor.RichMarkdownSlashMenu.dbdd2ad15f',
            'Search blocks...'
          )}
        />
      </div>
      <div className="rich-markdown-slash-results scrollbar-sleek" role="listbox">
        {filteredCommands.length === 0 ? (
          <div className="rich-markdown-slash-empty">
            {translate(
              'auto.components.editor.RichMarkdownSlashMenu.82c6816ff8',
              'No blocks found'
            )}
          </div>
        ) : (
          filteredCommands.map((command, index) => {
            const showGroup = command.group !== currentGroup
            currentGroup = command.group
            return (
              <React.Fragment key={command.id}>
                {showGroup ? (
                  <div className="rich-markdown-slash-section">{command.group}</div>
                ) : null}
                <button
                  type="button"
                  title={command.description}
                  role="option"
                  aria-selected={index === selectedIndex}
                  className={cn('rich-markdown-slash-item', index === selectedIndex && 'is-active')}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    editor && runSlashCommand(editor, slashMenu, command, onImagePick, onEmojiPick)
                  }
                >
                  <span className="rich-markdown-slash-icon">
                    {command.icon.kind === 'component' ? (
                      <command.icon.component className="size-3.5" />
                    ) : (
                      <span className="text-sm leading-none">{command.icon.value}</span>
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col items-start">
                    <span className="truncate text-[13px] font-medium leading-5">
                      {command.label}
                    </span>
                  </span>
                </button>
              </React.Fragment>
            )
          })
        )}
      </div>
    </div>
  )
  return portalToDocument ? createPortal(menu, document.body) : menu
}
