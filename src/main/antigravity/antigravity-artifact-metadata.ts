import { readFileSync, statSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { z } from 'zod'
import {
  ANTIGRAVITY_ARTIFACT_INPUT_KEY,
  MAX_PLAN_DOCUMENT_SUMMARY
} from '../../shared/native-chat-plan-document'

// agy writes `<artifact>.metadata.json` beside each artifact it produces (the plan mode document);
// the stream's write_file parameters carry only `Path`, so the sidecar is the structured marker.

const MAX_SIDECAR_BYTES = 64 * 1024
const ARTIFACT_WRITE_TOOLS = new Set(['write_file', 'edit_file'])

const sidecarSchema = z.looseObject({
  summary: z.string().optional(),
  requestFeedback: z.boolean().optional(),
  userFacing: z.boolean().optional()
})

// The write tools' parameters carry the artifact `Path`; anything else is left untouched.
const artifactWriteInputSchema = z.looseObject({ Path: z.string().optional() })

export function readAntigravityArtifactSidecar(path: string): z.infer<typeof sidecarSchema> | null {
  const sidecarPath = `${path}.metadata.json`
  try {
    if (statSync(sidecarPath).size > MAX_SIDECAR_BYTES) {
      return null
    }
    const parsed = sidecarSchema.safeParse(JSON.parse(readFileSync(sidecarPath, 'utf8')))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** A completed artifact write's input, with the sidecar's fields beside `Path`. Any other call, a
 *  write with no readable sidecar, or a sidecar that does not match is returned unchanged. */
export function withAntigravityArtifactMetadata(name: string, input: unknown): unknown {
  const written = artifactWriteInputSchema.safeParse(input)
  if (!ARTIFACT_WRITE_TOOLS.has(name) || !written.success) {
    return input
  }
  const path = written.data.Path
  if (path === undefined || !isAbsolute(path)) {
    return input
  }
  const sidecar = readAntigravityArtifactSidecar(path)
  if (!sidecar) {
    return input
  }
  return {
    ...written.data,
    [ANTIGRAVITY_ARTIFACT_INPUT_KEY]: {
      userFacing: sidecar.userFacing === true,
      requestFeedback: sidecar.requestFeedback === true,
      ...(sidecar.summary ? { summary: sidecar.summary.slice(0, MAX_PLAN_DOCUMENT_SUMMARY) } : {})
    }
  }
}
