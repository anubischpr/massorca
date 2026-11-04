import { createContext, type ReactNode } from 'react'

/** Draws a plain run of prose (no Markdown in it) as nodes, or null to keep the run as written. */
export type MarkdownPlainTextRenderer = (text: string, keyPrefix: string) => ReactNode[] | null

/** Set only by a transcript that draws extra marks in plain prose, such as the room's mention chips. */
export const MarkdownPlainTextContext = createContext<MarkdownPlainTextRenderer | null>(null)
