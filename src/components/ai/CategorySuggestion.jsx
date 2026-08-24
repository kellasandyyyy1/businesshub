import { IconSparkles } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'

import { AiError, AiLoading } from './AiStatus'
import { db } from '../../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../../db/queries'
import { MODEL_FAST, callGroq, hasApiKey, parseJsonLoose } from '../../lib/ai'

/** Built before the profile split, so it reads the business side. */
const inProfile = ofProfile(BUSINESS_PROFILE)

/** Confirmed categorisations, newest first, for few-shot prompting. */
export async function recentExamples(limit = 20) {
  const history = await db.categorizationHistory.orderBy('confirmedAt').reverse().limit(limit).toArray()
  if (history.length >= 5) return history

  // A fresh install has no confirmations yet, but the ledger itself is full of
  // decisions the user already made.
  const fallback = await db.transactions.orderBy('date').reverse().filter(inProfile).limit(limit).toArray()
  return [
    ...history,
    ...fallback.map((t) => ({
      description: t.description,
      amount: t.amount,
      category: t.category,
      confirmedAt: t.createdAt,
    })),
  ].slice(0, limit)
}

/** Records a decision so later suggestions learn from it. */
export async function recordCategorization({ description, amount, category }) {
  if (!description?.trim() || !category) return
  await db.categorizationHistory.add({
    description: description.trim(),
    amount: Number(amount) || 0,
    category,
    confirmedAt: new Date().toISOString(),
  })
}

const SYSTEM = (categories) =>
  `You are a transaction categorizer for a Philippine small business. Given a transaction description and amount, return ONLY valid JSON — no markdown, no explanation, no backticks:
{ "category": string, "confidence": "high" | "medium" | "low" }
Available categories: ${categories.join('; ')}.
Use past examples to match patterns.`

/**
 * Suggests a category once there is enough to go on. Fires only when the field
 * is still blank, so it never overrides a choice the user has already made.
 */
export default function CategorySuggestion({ description, amount, type, categories, onAccept }) {
  const [suggestion, setSuggestion] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const abortRef = useRef(null)

  const ready = description.trim().length > 3 && Number(amount) > 0
  const names = categories.filter((c) => type === 'transfer' || c.type === type).map((c) => c.name)

  useEffect(() => {
    if (!ready || dismissed) {
      setSuggestion(null)
      return undefined
    }

    let cancelled = false
    // Debounced: the field is still being typed into.
    const timer = setTimeout(async () => {
      if (!hasApiKey()) return // Stay silent when AI is not configured.

      setLoading(true)
      setError(null)
      try {
        const examples = await recentExamples(20)
        const controller = new AbortController()
        abortRef.current = controller

        const raw = await callGroq({
          model: MODEL_FAST,
          system: SYSTEM(names),
          messages: [
            {
              role: 'user',
              content: `Description: ${description}, Amount: ${Number(amount)}
Past examples: ${JSON.stringify(
                examples.slice(0, 5).map((e) => ({
                  description: e.description,
                  amount: e.amount,
                  category: e.category,
                })),
              )}`,
            },
          ],
          temperature: 0.2,
          maxTokens: 120,
          jsonMode: true,
          signal: controller.signal,
        })

        const parsed = parseJsonLoose(raw)
        // A hallucinated category is worse than no suggestion at all.
        if (!cancelled && names.includes(parsed.category)) {
          setSuggestion({
            category: parsed.category,
            confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
              ? parsed.confidence
              : 'medium',
          })
        }
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError' && err.code !== 'NO_API_KEY') setError(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 700)

    return () => {
      cancelled = true
      clearTimeout(timer)
      abortRef.current?.abort()
    }
    // Re-runs when the inputs that define the suggestion change.
  }, [description, amount, type, dismissed, ready, names.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready || dismissed) return null
  if (loading) return <AiLoading label="Categorizing" />
  if (error) return <AiError error={error} />
  if (!suggestion) return null

  return (
    <div className="bfh-suggest">
      <span className="bfh-suggest__pill" data-confidence={suggestion.confidence}>
        <IconSparkles size={11} stroke={1.5} aria-hidden="true" />
        {suggestion.category}
      </span>
      <button
        type="button"
        className="bfh-suggest__confirm"
        onClick={() => {
          onAccept(suggestion.category)
          setDismissed(true)
        }}
      >
        Confirm
      </button>
      <button type="button" className="bfh-suggest__dismiss" onClick={() => setDismissed(true)}>
        Dismiss
      </button>
    </div>
  )
}
