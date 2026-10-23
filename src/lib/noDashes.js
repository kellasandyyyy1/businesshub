/**
 * The app never shows an em dash, and models reach for them constantly, so
 * every AI reply passes through this before anything reads it. A dash between
 * words becomes a comma; one at either end is dropped.
 */
const DASH = /\s*\u2014\s*/g

export default function noDashes(text) {
  const source = String(text ?? '')
  return source.replace(DASH, (dash, offset) =>
    offset === 0 || offset + dash.length === source.length ? '' : ', ',
  )
}
