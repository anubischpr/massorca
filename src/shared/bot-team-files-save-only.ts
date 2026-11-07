import { plainWords } from './bot-team-request-action'

// Words that may stand around a save order without changing what it asks: courtesy, "only", "yes".
const FILLER_WORDS = new Set([
  'solo',
  'only',
  'just',
  'por',
  'favor',
  'please',
  'porfa',
  'ya',
  'si',
  'yes',
  'ok',
  'okay',
  'vale',
  'bueno',
  'pues',
  'entonces',
  'gracias',
  'thanks'
])

// Words that name the files a save order is about, so "guarda el archivo" reads as "guárdalo".
const FILE_WORDS = new Set([
  'el',
  'la',
  'los',
  'las',
  'lo',
  'un',
  'una',
  'a',
  'an',
  'the',
  'it',
  'them',
  'this',
  'that',
  'these',
  'those',
  'todo',
  'todos',
  'todas',
  'all',
  'esto',
  'eso',
  'este',
  'esta',
  'estos',
  'estas',
  'ese',
  'esa',
  'esos',
  'esas',
  'archivo',
  'archivos',
  'file',
  'files',
  'imagen',
  'imagenes',
  'image',
  'images',
  'foto',
  'fotos',
  'photo',
  'photos',
  'documento',
  'documentos',
  'document',
  'documents',
  'adjunto',
  'adjuntos',
  'attachment',
  'attachments',
  'pdf',
  'video',
  'videos',
  'informe',
  'informes',
  'report',
  'reports'
])

// Keep or save, in the imperative or infinitive, with an object pronoun fused on ("guárdalo", "guardalos").
const SAVE_ORDER =
  /^(?:guard|archiv|conserv)(?:a|ar|e|en|ad)(?:me|te|nos|se)?(?:lo|la|los|las)?$|^(?:save|keep|store|archive)$/u

/**
 * Whether a line only asks to keep files: "Sólo guárdalo", "solo guarda el archivo", "just save it".
 * Any other word (an instruction, a time, a place) makes it a request, read as before.
 */
export function isBotTeamSaveOnlyText(text: string): boolean {
  const [first, ...rest] = plainWords(text).filter(
    (word) => !FILLER_WORDS.has(word) && !FILE_WORDS.has(word)
  )
  return first !== undefined && rest.length === 0 && SAVE_ORDER.test(first)
}
