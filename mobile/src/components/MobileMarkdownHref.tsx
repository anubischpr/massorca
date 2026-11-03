import { openExternalLink } from '../platform/external-link'
import { routeMarkdownHref } from './markdown-href-routing'

// Web/mail hrefs open the system handler; file-target hrefs (file: URIs and
// scheme-less paths — the entire desktop file-link contract) go to onOpenFile.
export function openMarkdownHref(href: string, onOpenFile?: (pathText: string) => void): void {
  const route = routeMarkdownHref(href)
  if (route.kind === 'web') {
    // The seam, not react-native's `Linking`: this module is in the tasks page closure, and inside
    // the shell's WebView `openURL` resolves without opening anything.
    openExternalLink(route.url)
    return
  }
  if (route.kind === 'file' && onOpenFile) {
    onOpenFile(route.pathText)
  }
}
