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

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u
const GENTLE_DESIGN_FOLDER = 'design'

const prototypeRequestManifestSchema = z.object({
  version: z.literal(1),
  requestId: z.string().regex(REQUEST_ID_PATTERN),
  agent: z.enum(PROTOTYPE_AGENTS),
  sessionId: z.string().min(1),
  originalPrompt: z.string(),
  count: z.int().min(PROTOTYPE_COUNT_MIN).max(PROTOTYPE_COUNT_MAX),
  createdAt: z.iso.datetime(),
  gentleDesignBaseline: z.array(z.string()).optional()
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

const gentleDesignSchema = z.object({
  title: z.string(),
  brief: z.string(),
  artboards: z
    .array(gentleArtboardSchema)
    .min(1)
    .max(PROTOTYPE_DIRECTION_LETTERS.length)
    .refine(
      (artboards) => new Set(artboards.map((artboard) => artboard.file)).size === artboards.length
    )
})

/** The set of a design/<slug>/ folder from a Gentle Shell request: one direction per artboard. */
export function buildGentleDesignSet(
  manifest: PrototypeRequestManifest,
  slug: string,
  designJson: unknown
): PrototypeSet | null {
  if (manifest.agent !== 'gentle-shell' || !isPlainPathSegment(slug)) {
    return null
  }
  const result = gentleDesignSchema.safeParse(designJson)
  if (!result.success) {
    return null
  }
  return {
    setId: manifest.requestId,
    requestText: manifest.originalPrompt,
    directions: result.data.artboards.map((artboard, index) => ({
      letter: directionLetter(index),
      versions: [{ version: 1, fileName: `${GENTLE_DESIGN_FOLDER}/${slug}/${artboard.file}` }]
    }))
  }
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
