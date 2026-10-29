import { ipcRenderer } from 'electron'
import { PROTOTYPE_CAPTURE_RECT_CHANNEL } from '../../shared/prototype-capture-types'
import type { PreloadApi } from '../api-types'

export const prototypeCaptureApi = {
  captureRect: (rect) => ipcRenderer.invoke(PROTOTYPE_CAPTURE_RECT_CHANNEL, rect)
} satisfies PreloadApi['prototypeCapture']
