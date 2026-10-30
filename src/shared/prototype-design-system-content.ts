// What a design system's files hold once read: its tokens with their metadata, and its components with their
// style block. Shared by every client that shows a system, so each reads the same files the same way.
import { parseComponentsHtml, type ComponentSection } from './prototype-design-system-components'
import {
  parseDesignTokens,
  type DesignSystemMeta,
  type DesignToken
} from './prototype-design-system-tokens'

export type DesignSystemContent = {
  tokens: readonly DesignToken[]
  meta: DesignSystemMeta
  components: readonly ComponentSection[]
  styleBlock: string
}

/** The content of the files a host read; a missing or invalid file reads as empty, never as an error. */
export function designSystemContentOf(files: {
  tokensJson?: string
  componentsHtml?: string
}): DesignSystemContent {
  const tokens = files.tokensJson === undefined ? null : parseDesignTokens(files.tokensJson)
  const components =
    files.componentsHtml === undefined ? null : parseComponentsHtml(files.componentsHtml)
  return {
    tokens: tokens?.tokens ?? [],
    meta: tokens?.meta ?? { history: [], sources: [], palettes: [] },
    components: components?.sections ?? [],
    styleBlock: components?.styleBlock ?? ''
  }
}
