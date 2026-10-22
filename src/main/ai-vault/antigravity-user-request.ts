import { extractString } from './session-scanner-values'

const USER_REQUEST_OPENER = '<USER_REQUEST>'
const USER_REQUEST_CLOSER = '</USER_REQUEST>'

/** The user's typed prompt inside an Antigravity USER_INPUT row, without its envelope tags. */
export function extractAntigravityUserRequest(content: string): string | null {
  const startIndex = content.indexOf(USER_REQUEST_OPENER)
  if (startIndex === -1) {
    return extractString(content)
  }
  const bodyStart = startIndex + USER_REQUEST_OPENER.length
  const endIndex = content.indexOf(USER_REQUEST_CLOSER, bodyStart)
  return extractString(
    endIndex === -1 ? content.slice(bodyStart) : content.slice(bodyStart, endIndex)
  )
}
