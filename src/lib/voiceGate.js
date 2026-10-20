/**
 * Decides whether a recognised phrase is something a person actually said.
 *
 * The browser recogniser will turn a breath, a fan or a television into words
 * if it is given the chance. These checks are the last line between that and
 * a question sent to the assistant on the person's behalf. They are pure so
 * they can be tested without a microphone.
 */

/** Below this the recogniser is guessing. Chrome reports 0 when it has no score at all. */
export const CONFIDENCE_THRESHOLD = 0.6

/** Shorter than this from the mic opening to a result is a tap, not a sentence. */
export const MIN_DURATION_MS = 800

/** One-word answers people genuinely give, in English and Filipino. */
const SINGLE_WORDS = new Set([
  'yes', 'no', 'ok', 'okay', 'cancel', 'stop', 'back', 'help',
  'oo', 'opo', 'hindi', 'sige', 'ayos', 'tama',
])

/** Counting static comes back spelled out as often as in digits. */
const NUMBER_WORDS = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'hundred', 'thousand', 'million',
])

/**
 * The alternative worth keeping, or null when every one is a low-confidence
 * guess. A score of 0 means "no score", never "certainly wrong", so it is
 * never grounds for rejection.
 */
export function pickAlternative(alternatives) {
  const list = Array.from(alternatives ?? []).filter((a) => a?.transcript?.trim())
  if (list.length === 0) return null
  const [first] = list
  if (!(first.confidence > 0) || first.confidence >= CONFIDENCE_THRESHOLD) return first
  const best = list.reduce((a, b) => (b.confidence > a.confidence ? b : a))
  return best.confidence >= CONFIDENCE_THRESHOLD ? best : null
}

/**
 * Null when the phrase passes; otherwise a short reason, kept for the console.
 */
export function rejectReason(transcript, durationMs) {
  const text = String(transcript ?? '').trim()
  if (durationMs < MIN_DURATION_MS) return `too short (${durationMs}ms)`
  if (text.length < 2) return 'empty'

  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 1 && !SINGLE_WORDS.has(text.toLowerCase().replace(/[.!?,]/g, ''))) {
    return `single word "${text}"`
  }
  // A run of bare numbers with nothing around them is the recogniser counting
  // static. "add 500 sa food" has words around its number and passes.
  const isNumber = (w) => /^[\d.,]+$/.test(w) || NUMBER_WORDS.has(w.toLowerCase())
  if (words.length > 3 && words.every(isNumber)) return 'numbers only'
  return null
}
