// A rectangle of the chat window captured for a note on a prototype. The main process takes the
// capture and returns the PNG as base64.

export const PROTOTYPE_CAPTURE_RECT_CHANNEL = 'prototypeCapture:captureRect'

/** A rectangle of the calling window's page, in CSS pixels; the handler rounds it to whole pixels. */
export type PrototypeCaptureRect = { x: number; y: number; width: number; height: number }

/** The captured PNG, base64 encoded, or why it was not taken. */
export type PrototypeCaptureResult =
  | { ok: true; pngBase64: string }
  | { ok: false; error: 'too_large' | 'unavailable' }
