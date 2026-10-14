import {
  createIncrementalNdjsonFramer,
  NDJSON_MAX_LINE_BYTES,
  type IncrementalNdjsonFramer
} from '../../shared/main-process-ndjson-framer'
import { AntigravityStreamProtocolError } from './antigravity-stream-json-protocol'

/** Converts bounded NDJSON framing failures into the provider's protocol errors. */
export function createAntigravityStreamFramer(
  onRecord: (record: unknown) => void,
  onError: (error: Error) => void,
  maxLineBytes = NDJSON_MAX_LINE_BYTES
): IncrementalNdjsonFramer {
  return createIncrementalNdjsonFramer(
    onRecord,
    (rejected) =>
      onError(
        new AntigravityStreamProtocolError(
          rejected.kind === 'invalid-json'
            ? `Invalid Antigravity NDJSON: ${rejected.error.message}`
            : `Antigravity NDJSON line exceeded ${rejected.maxLineBytes} bytes`
        )
      ),
    { maxLineBytes }
  )
}
