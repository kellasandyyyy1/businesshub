import noDashes from './noDashes'

/**
 * Splits a model reply into the prose half and the trailing JSON block.
 *
 * The obvious approach, take everything from the last `{`, looks right and
 * fails on the common case. A block carrying stats ends
 * `…{"label":…,"value":…}],"followUps":[…]}`, so the last `{` opens the *nested*
 * stat object; parsing from there throws, and the fallback then shows the raw
 * JSON to the reader. An action block nests deeper still, the last `{` lands
 * inside `prefill`, so it would fail every single time. Walking back from the
 * final `}` and balancing depth finds the block's real opening brace instead.
 */

/** Models sometimes fence the JSON; the opening fence is left in the prose half. */
const stripTrailingFence = (s) => s.replace(/\s*```[a-z]*\s*$/i, '').trim()


const asArray = (value) => (Array.isArray(value) ? value : [])

export function parseAIResponse(raw) {
  const source = noDashes(raw).trim()
  const end = source.lastIndexOf('}')
  if (end === -1) return { text: source, stats: [], followUps: [], action: null, actions: [] }

  let depth = 0
  for (let i = end; i >= 0; i -= 1) {
    const char = source[i]
    if (char === '}') depth += 1
    else if (char === '{') {
      depth -= 1
      if (depth !== 0) continue

      try {
        const parsed = JSON.parse(source.slice(i, end + 1))
        return {
          text: stripTrailingFence(source.slice(0, i)),
          stats: asArray(parsed.stats),
          followUps: asArray(parsed.followUps),
          // A model now and then returns the action object itself instead of
          // wrapping it; a block with its own `type` is that action.
          action: parsed.action ?? (typeof parsed.type === 'string' ? parsed : null),
          // Several transactions in one message arrive as a list; a single one
          // arrives as `action`. Callers always get both keys.
          actions: asArray(parsed.actions),
        }
      } catch {
        const block = source.slice(i, end + 1)
        // Balanced braces that will not parse. If the block was plainly meant to
        // be the meta block, drop it rather than showing the reader a broken
        // object, that is the exact thing this screen must never do. Anything
        // else is prose that happens to contain braces, so it stays.
        const isMetaBlock = /"(stats|followUps|actions?|type)"\s*:/.test(block)
        return {
          text: isMetaBlock ? stripTrailingFence(source.slice(0, i)) : source,
          stats: [],
          followUps: [],
          action: null,
          actions: [],
        }
      }
    }
  }

  return { text: source, stats: [], followUps: [], action: null, actions: [] }
}

export default parseAIResponse
