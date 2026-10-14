import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ORCAD_CLAUDE_SDK_ARTIFACTS } from '../../src/shared/orcad-artifacts.ts'

/** Stage only the declared portable SDK files; never copy host-native optional packages. */
export function stageOrcadClaudeSdk(projectRoot, artifactRoot) {
  for (const filename of ORCAD_CLAUDE_SDK_ARTIFACTS) {
    const destination = join(artifactRoot, filename)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(join(projectRoot, filename), destination)
  }
}
