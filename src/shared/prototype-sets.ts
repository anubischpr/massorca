// The directions of one prototype request: the manifest in its request.json, the set read from its
// folder, and the set read from a Gentle Shell design/<slug>/ folder.
import { z } from 'zod'
import { PROTOTYPE_COUNT_MAX, PROTOTYPE_COUNT_MIN } from './prototype-count-setting'
import { PROTOTYPE_AGENTS } from './prototype-request'
import {
  directionLetter,
  isPlainPathSegment,
  isRelativeFilePath,
  parsePrototypeFileName,
  PROTOTYPE_DIRECTION_LETTERS,
  prototypeRequestFolder
} from './prototype-request-folder'

export type PrototypeVersion = {
  version: number
  fileName: string
}

export type PrototypeDirection = {
  letter: string
  versions: PrototypeVersion[]
}

export type PrototypeSet = {
  setId: string
  requestText: string
  directions: PrototypeDirection[]
}

export const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u
const GENTLE_DESIGN_FOLDER = 'design'
const MANIFEST_TEXT_MAX_LENGTH = 512

const prototypeRequestManifestSchema = z.object({
  version: z.literal(1),
  requestId: z.string().regex(REQUEST_ID_PATTERN),
  agent: z.enum(PROTOTYPE_AGENTS),
  sessionId: z.string().min(1),
  originalPrompt: z.string(),
  count: z.int().min(PROTOTYPE_COUNT_MIN).max(PROTOTYPE_COUNT_MAX),
  createdAt: z.iso.datetime(),
  gentleDesignBaseline: z.array(z.string()).optional(),
  // Optional, so manifests written before these fields existed still parse.
  worktreeId: z.string().min(1).max(MANIFEST_TEXT_MAX_LENGTH).optional(),
  chatTitle: z.string().max(MANIFEST_TEXT_MAX_LENGTH).optional(),
  // The chat's launch directory on the host: where Gentle Shell's design/ folder lives.
  sessionCwd: z.string().min(1).max(4096).optional(),
  // The design/<slug>/ folder bound on first resolution, so a design folder that appears later cannot rebind it.
  gentleDesignSlug: z.string().refine(isPlainPathSegment).optional()
})

export type PrototypeRequestManifest = z.infer<typeof prototypeRequestManifestSchema>

/** The request.json of a request folder, or null when it is not a valid version 1 manifest. */
export function parsePrototypeRequestManifest(input: unknown): PrototypeRequestManifest | null {
  const result = prototypeRequestManifestSchema.safeParse(input)
  return result.success ? result.data : null
}

/** The set of a request folder, from the names of its entries. Other entries are ignored. */
export function buildPrototypeSet(
  manifest: PrototypeRequestManifest,
  fileNames: readonly string[]
): PrototypeSet {
  const folder = prototypeRequestFolder(manifest.requestId)
  const versionsByLetter = new Map<string, PrototypeVersion[]>()
  for (const fileName of fileNames) {
    const parsed = parsePrototypeFileName(fileName)
    if (parsed !== null) {
      const versions = versionsByLetter.get(parsed.letter) ?? []
      versions.push({ version: parsed.version, fileName: `${folder}/${fileName}` })
      versionsByLetter.set(parsed.letter, versions)
    }
  }
  const directions = [...versionsByLetter.keys()].sort().map((letter) => ({
    letter,
    versions: (versionsByLetter.get(letter) ?? []).sort(
      (left, right) => left.version - right.version
    )
  }))
  return { setId: manifest.requestId, requestText: manifest.originalPrompt, directions }
}

const gentleArtboardSchema = z.object({
  file: z.string().refine(isRelativeFilePath),
  title: z.string(),
  tradeoff: z.string().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional()
})

// The design must parse as a whole, but an artboard is judged alone: a bad one is left out.
const gentleDesignSchema = z.object({
  title: z.string(),
  brief: z.string(),
  artboards: z.array(z.unknown()).min(1).max(PROTOTYPE_DIRECTION_LETTERS.length)
})

type GentleArtboard = z.infer<typeof gentleArtboardSchema>

/** The set of a design/<slug>/ folder from a Gentle Shell request: one direction per artboard it keeps. */
export function buildGentleDesignSet(
  manifest: PrototypeRequestManifest,
  slug: string,
  designJson: unknown
): PrototypeSet | null {
  if (manifest.agent !== 'gentle-shell' || !isPlainPathSegment(slug)) {
    return null
  }
  const result = gentleDesignSchema.safeParse(designJson)
  const artboards = result.success ? keptArtboards(result.data.artboards) : []
  if (artboards.length === 0) {
    return null
  }
  return {
    setId: manifest.requestId,
    requestText: manifest.originalPrompt,
    directions: artboards.map((artboard, index) => ({
      letter: directionLetter(index),
      versions: [{ version: 1, fileName: `${GENTLE_DESIGN_FOLDER}/${slug}/${artboard.file}` }]
    }))
  }
}

// An artboard that does not parse, or repeats the file of an earlier one, is left out; the rest stay.
function keptArtboards(candidates: readonly unknown[]): GentleArtboard[] {
  const files = new Set<string>()
  const kept: GentleArtboard[] = []
  for (const candidate of candidates) {
    const parsed = gentleArtboardSchema.safeParse(candidate)
    if (parsed.success && !files.has(parsed.data.file)) {
      files.add(parsed.data.file)
      kept.push(parsed.data)
    }
  }
  return kept
}

/** The one design/<slug>/ folder that is new since the request was sent, or null if not exactly one. */
export function resolveGentleDesignSlug(
  baseline: readonly string[],
  currentSlugs: readonly string[]
): string | null {
  const known = new Set(baseline)
  const added = [...new Set(currentSlugs.filter((slug) => !known.has(slug)))]
  const [only, ...others] = added
  return only !== undefined && others.length === 0 ? only : null
}
