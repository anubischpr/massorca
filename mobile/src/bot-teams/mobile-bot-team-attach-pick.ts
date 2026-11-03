/** A file the person picked on the phone: its name, its size when the picker knows it, and its bytes. */
export type PickedBotTeamRoomFile = {
  name: string
  size: number | null
  base64: () => Promise<string>
}

/**
 * The OS file picker for any file; null when the person cancels. The picker modules load on first
 * use, so drawing the room never loads the native document picker.
 */
export async function pickMobileBotTeamRoomFile(): Promise<PickedBotTeamRoomFile | null> {
  const DocumentPicker = await import('expo-document-picker')
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: false,
    copyToCacheDirectory: true
  })
  if (result.canceled) {
    return null
  }
  const asset = result.assets[0]
  if (!asset?.uri) {
    return null
  }
  const uri = asset.uri
  return {
    name: asset.name,
    size: typeof asset.size === 'number' ? asset.size : null,
    base64: async () => {
      const { File: FsFile } = await import('expo-file-system')
      return new FsFile(uri).base64()
    }
  }
}
