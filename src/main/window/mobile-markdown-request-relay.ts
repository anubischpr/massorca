import type { BrowserWindow } from 'electron'
import type {
  RuntimeMarkdownReadTabResult,
  RuntimeMarkdownSaveTabResult,
  RuntimeMobileMarkdownRequest
} from '../../shared/mobile-markdown-document'
import { requestFromRenderer } from './renderer-request-relay'

const MOBILE_MARKDOWN_RENDERER_TIMEOUT_MS = 20_000

type RendererMobileMarkdownRequest = RuntimeMobileMarkdownRequest extends infer Request
  ? Request extends { id: string }
    ? Omit<Request, 'id'>
    : never
  : never

export function requestMobileMarkdownFromRenderer(
  mainWindow: BrowserWindow,
  request: RendererMobileMarkdownRequest
): Promise<RuntimeMarkdownReadTabResult | RuntimeMarkdownSaveTabResult> {
  return requestFromRenderer<
    RuntimeMarkdownReadTabResult | RuntimeMarkdownSaveTabResult,
    RendererMobileMarkdownRequest
  >(
    mainWindow,
    {
      requestChannel: 'ui:mobileMarkdownRequest',
      responseChannel: 'ui:mobileMarkdownResponse',
      timeoutMs: MOBILE_MARKDOWN_RENDERER_TIMEOUT_MS
    },
    request
  )
}
