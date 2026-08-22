import { useCallback, useEffect, useRef, useState } from 'react'

import {
  MODEL_DEFAULT,
  buildFinancialContext,
  callGroq,
  dataFingerprint,
  hasApiKey,
  isStale,
  parseJsonLoose,
  readAiCache,
  writeAiCache,
} from '../lib/ai'

const SYSTEM = `You are a financial analyst for a Philippine small business. Analyze the data and return ONLY a valid JSON array — no markdown, no backticks, no explanation. Wrap the array as { "insights": [...] }. Each element:
{
  "id": string,
  "title": string (max 8 words, plain language),
  "body": string (1-2 sentences, specific numbers, actionable advice),
  "tag": "Client Risk" | "Expense" | "Revenue" | "Cash Flow" | "Invoice" | "Budget",
  "priority": 1-5
}
Priority 1 = most urgent action needed. Priority 5 = positive or informational.
Only surface insights where the data is meaningful. Minimum 3, maximum 8 insights.`

const VALID_TAGS = ['Client Risk', 'Expense', 'Revenue', 'Cash Flow', 'Invoice', 'Budget']

/**
 * AI insights, cached in Dexie. The API is only called when the books have
 * changed since the last run, the cache is over a day old, or the user asks
 * for a refresh — page visits alone never spend a request.
 */
export function useAiInsights() {
  const [state, setState] = useState({ status: 'idle', insights: null, generatedAt: null })
  const [error, setError] = useState(null)
  const startedRef = useRef(false)

  const generate = useCallback(async (force = false) => {
    setError(null)

    const fingerprint = await dataFingerprint()
    const cached = await readAiCache('insights')

    if (!force && cached && !isStale(cached, fingerprint)) {
      setState({ status: 'ready', insights: cached.value, generatedAt: cached.generatedAt })
      return
    }

    if (!hasApiKey()) {
      // Show whatever was last generated rather than nothing at all.
      if (cached) {
        setState({ status: 'ready', insights: cached.value, generatedAt: cached.generatedAt })
      } else {
        setState({ status: 'idle', insights: null, generatedAt: null })
      }
      setError(Object.assign(new Error('No API key'), { code: 'NO_API_KEY' }))
      return
    }

    setState((s) => ({ ...s, status: 'loading' }))

    try {
      const context = await buildFinancialContext(6)
      const raw = await callGroq({
        model: MODEL_DEFAULT,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Financial data:\n${context}` }],
        temperature: 0.2,
        maxTokens: 1400,
        jsonMode: true,
      })

      const parsed = parseJsonLoose(raw)
      const list = Array.isArray(parsed) ? parsed : parsed.insights
      if (!Array.isArray(list) || list.length === 0) {
        throw Object.assign(new Error('No insights returned'), { code: 'PARSE' })
      }

      const insights = list
        .filter((i) => i?.title && i?.body)
        .slice(0, 8)
        .map((i, index) => ({
          id: String(i.id ?? `ai-${index}`),
          title: String(i.title),
          body: String(i.body),
          tag: VALID_TAGS.includes(i.tag) ? i.tag : 'Revenue',
          priority: Number(i.priority) >= 1 && Number(i.priority) <= 5 ? Number(i.priority) : 3,
        }))
        .sort((a, b) => a.priority - b.priority)

      const row = await writeAiCache('insights', insights, fingerprint)
      setState({ status: 'ready', insights, generatedAt: row.generatedAt })
    } catch (err) {
      setError(err)
      if (cached) {
        setState({ status: 'ready', insights: cached.value, generatedAt: cached.generatedAt })
      } else {
        setState({ status: 'idle', insights: null, generatedAt: null })
      }
    }
  }, [])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    generate(false)
  }, [generate])

  return { ...state, error, regenerate: () => generate(true) }
}

export default useAiInsights
