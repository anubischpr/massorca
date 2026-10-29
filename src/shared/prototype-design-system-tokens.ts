// tokens.json of a design system (W3C design-tokens shape), read into an ordered token list and its
// metadata. Every part is read on its own: a missing or invalid part is dropped, never fatal.
import { z } from 'zod'

export const DESIGN_TOKEN_GROUPS = ['color', 'type', 'space', 'radius', 'shadow', 'motion'] as const

/** The groups the editor lets a user change; shadow and motion are display-only. */
export const DESIGN_SELECTABLE_TOKEN_GROUPS: readonly string[] = [
  'color',
  'type',
  'space',
  'radius'
]

const MAX_TOKENS = 2000
const MAX_TREE_DEPTH = 4
const MAX_HISTORY = 100
const MAX_SOURCES = 50
const MAX_PALETTES = 8

export type DesignToken = {
  /** `group.name`. */
  id: string
  group: string
  name: string
  /** The leaf's `$type`, else its group. */
  type: string
  value: string
  description?: string
  weight?: number
}

const statusSchema = z.enum(['detected', 'proposed'])

export type DesignSystemStatus = z.infer<typeof statusSchema>

const historyEntrySchema = z.object({
  version: z.int().min(1),
  status: statusSchema.optional().catch(undefined),
  at: z.string().max(40).optional().catch(undefined)
})

const sourceSchema = z.object({
  path: z.string().min(1).max(500),
  took: z.string().max(500).catch('')
})

const paletteSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  note: z.string().max(300).optional().catch(undefined),
  swatches: z.array(z.string().max(64)).max(12).catch([]),
  tokens: z.record(z.string(), z.string().max(200)).catch({})
})

const metadataSchema = z.object({
  version: z.int().min(1).optional().catch(undefined),
  status: statusSchema.optional().catch(undefined),
  agent: z.string().max(80).optional().catch(undefined),
  updatedAt: z.string().max(40).optional().catch(undefined)
})

export type DesignSystemHistoryEntry = z.infer<typeof historyEntrySchema>
export type DesignSystemSource = z.infer<typeof sourceSchema>
export type DesignSystemPalette = z.infer<typeof paletteSchema>

export type DesignSystemMeta = z.infer<typeof metadataSchema> & {
  history: DesignSystemHistoryEntry[]
  sources: DesignSystemSource[]
  palettes: DesignSystemPalette[]
}

export type ParsedDesignTokens = {
  tokens: DesignToken[]
  meta: DesignSystemMeta
}

/** `--group-name`: the dots of a token id become dashes. */
export function designTokenCssVar(tokenId: string): string {
  return `--${tokenId.replace(/[^A-Za-z0-9_-]/gu, '-')}`
}

/** tokens.json read as written; null when it is not a JSON object. */
export function parseDesignTokens(json: string): ParsedDesignTokens | null {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return null
  }
  return parseDesignTokenTree(raw)
}

/** The tokens and metadata of an already parsed tokens.json; null when it is not an object. */
export function parseDesignTokenTree(raw: unknown): ParsedDesignTokens | null {
  if (!isRecord(raw)) {
    return null
  }
  const tokens: DesignToken[] = []
  const seen = new Set<string>()
  for (const group of orderedGroups(raw)) {
    const node = raw[group]
    if (isRecord(node)) {
      collectTokens(node, group, [], tokens, seen, 0)
    }
  }
  return { tokens, meta: parseMeta(raw['$extensions']) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// The known groups first, in their documented order, then any other group in file order.
function orderedGroups(raw: Record<string, unknown>): string[] {
  const known = DESIGN_TOKEN_GROUPS.filter((group) => Object.hasOwn(raw, group))
  const knownSet: ReadonlySet<string> = new Set(DESIGN_TOKEN_GROUPS)
  const others = Object.keys(raw).filter((key) => !key.startsWith('$') && !knownSet.has(key))
  return [...known, ...others]
}

function collectTokens(
  node: Record<string, unknown>,
  group: string,
  path: readonly string[],
  out: DesignToken[],
  seen: Set<string>,
  depth: number
): void {
  for (const [key, child] of Object.entries(node)) {
    if (out.length >= MAX_TOKENS) {
      return
    }
    if (key.startsWith('$') || !isRecord(child)) {
      continue
    }
    const nextPath = [...path, key]
    if (Object.hasOwn(child, '$value')) {
      const token = tokenOf(group, nextPath.join('.'), child)
      if (token !== null && !seen.has(token.id)) {
        seen.add(token.id)
        out.push(token)
      }
    } else if (depth < MAX_TREE_DEPTH) {
      collectTokens(child, group, nextPath, out, seen, depth + 1)
    }
  }
}

function tokenOf(group: string, name: string, leaf: Record<string, unknown>): DesignToken | null {
  const raw = leaf['$value']
  const value =
    typeof raw === 'string'
      ? raw
      : typeof raw === 'number' && Number.isFinite(raw)
        ? String(raw)
        : null
  if (value === null) {
    return null
  }
  const type = leaf['$type']
  const description = leaf['$description']
  const weight = massorcaExtension(leaf['$extensions'])?.['weight']
  return {
    id: `${group}.${name}`,
    group,
    name,
    type: typeof type === 'string' && type.length > 0 ? type : group,
    value,
    ...(typeof description === 'string' && description.length > 0 ? { description } : {}),
    ...(typeof weight === 'number' && Number.isFinite(weight) ? { weight } : {})
  }
}

function massorcaExtension(extensions: unknown): Record<string, unknown> | null {
  const massorca = isRecord(extensions) ? extensions['massorca'] : undefined
  return isRecord(massorca) ? massorca : null
}

function parseMeta(extensions: unknown): DesignSystemMeta {
  const massorca = massorcaExtension(extensions) ?? {}
  const scalars = metadataSchema.safeParse(massorca)
  return {
    ...(scalars.success ? scalars.data : {}),
    history: parseEach(historyEntrySchema, massorca['history'], MAX_HISTORY),
    sources: parseEach(sourceSchema, massorca['sources'], MAX_SOURCES),
    palettes: parseEach(paletteSchema, massorca['palettes'], MAX_PALETTES)
  }
}

// Each entry is judged alone: an invalid one is left out and the rest stay.
function parseEach<Item>(schema: z.ZodType<Item>, value: unknown, max: number): Item[] {
  if (!Array.isArray(value)) {
    return []
  }
  const kept: Item[] = []
  for (const candidate of value) {
    if (kept.length >= max) {
      break
    }
    const parsed = schema.safeParse(candidate)
    if (parsed.success) {
      kept.push(parsed.data)
    }
  }
  return kept
}
