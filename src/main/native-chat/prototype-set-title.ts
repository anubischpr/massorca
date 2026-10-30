// Names a prototype set with the chat-name generation, so the Prototypes lists show what is viewed
// instead of the chat's description. The name is patched into request.json after the send returns.

import { randomUUID } from 'node:crypto'
import { rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { LOCAL_COMMIT_MESSAGE_HOST_KEY } from '../../shared/commit-message-host-key'
import { PROTOTYPE_MANIFEST_FILE_NAME } from '../../shared/prototype-request-folder'
import { parsePrototypeRequestManifest } from '../../shared/prototype-sets'
import { resolveGenerationTarget } from '../agent-hooks/first-work-generation-target'
import {
  generateConversationNameFromContext,
  resolveTextGenerationParams
} from '../text-generation/commit-message-text-generation'
import type { CommitMessageAgentEnvironmentResolvers } from '../text-generation/commit-message-agent-environment'
import { readRequestManifest } from './prototype-request-disk'

/** The title for a set's visible request text, or null when no name could be generated. */
export type PrototypeSetTitleGenerator = (input: {
  originalPrompt: string
  launchDirectory: string
}) => Promise<string | null>

export function prototypeSetTitleGenerator(deps: {
  getStore: () => { getSettings: () => GlobalSettings } | null
  getAgentEnvResolvers: () => CommitMessageAgentEnvironmentResolvers | undefined
}): PrototypeSetTitleGenerator {
  return async ({ originalPrompt, launchDirectory }) => {
    const store = deps.getStore()
    if (!store) {
      return null
    }
    const settings = resolveTextGenerationParams(
      store.getSettings(),
      LOCAL_COMMIT_MESSAGE_HOST_KEY,
      'conversationName',
      null
    )
    if (!settings.ok) {
      return null
    }
    const target = await resolveGenerationTarget(
      launchDirectory,
      settings.params.agentId,
      null,
      deps
    )
    if (!target) {
      return null
    }
    const result = await generateConversationNameFromContext(
      { firstPrompt: originalPrompt },
      settings.params,
      target
    )
    return result.success ? result.name : null
  }
}

/**
 * Adds the generated title to a request's manifest. The manifest is rewritten through a temp file so a
 * reader never sees a partial file; a manifest that is missing or already titled is left alone.
 * @returns Whether the title was written.
 */
export async function writePrototypeSetTitle(requestFolder: string, title: string): Promise<boolean> {
  const manifest = await readRequestManifest(requestFolder)
  if (!manifest || manifest.title !== undefined) {
    return false
  }
  const next = parsePrototypeRequestManifest({ ...manifest, title })
  if (next === null) {
    return false
  }
  const manifestPath = join(requestFolder, PROTOTYPE_MANIFEST_FILE_NAME)
  const temporaryPath = `${manifestPath}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, JSON.stringify(next, null, 2))
  await rename(temporaryPath, manifestPath)
  return true
}
