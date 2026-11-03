/** The file kinds a team's previews tell apart, by name. */
export function isHtmlPath(relativePath: string): boolean {
  return /\.html?$/i.test(relativePath)
}

export function isImagePath(relativePath: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(relativePath)
}

export function isPdfPath(relativePath: string): boolean {
  return /\.pdf$/i.test(relativePath)
}
