import { IconRefresh, IconSparkles } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'

import { AiError, AiLoading } from '../ai/AiStatus'
import {
  MODEL_DEFAULT,
  buildFinancialContext,
  callGroq,
  dataFingerprint,
  parseJsonLoose,
  readAiCache,
  timeAgo,
  writeAiCache,
} from '../../lib/ai'
import { formatCurrency } from '../../lib/format'

const SCENARIOS = ['conservative', 'expected', 'optimistic']

const SYSTEM = `You are a financial forecaster. Based on the business data provided, return ONLY valid JSON — no markdown, no backticks:
{
  "scenarios": {
    "conservative": { "monthlyRevenue": number, "monthlyExpenses": number, "monthlyProfit": number, "endingCash": number, "runwayMonths": number, "recommendation": string },
    "expected": { "monthlyRevenue": number, "monthlyExpenses": number, "monthlyProfit": number, "endingCash": number, "runwayMonths": number, "recommendation": string },
    "optimistic": { "monthlyRevenue": number, "monthlyExpenses": number, "monthlyProfit": number, "endingCash": number, "runwayMonths": number, "recommendation": string }
  },
  "basedOn": [string],
  "confidence": "low" | "medium" | "high",
  "generatedAt": string
}
conservative = pessimistic case (revenue -20%, expenses +10% vs expected).
expected = most likely based on trend.
optimistic = upside case (revenue +30%, expenses flat vs expected).
recommendation = one plain-language sentence about what the business should do.
basedOn = array of data points you used.`

const DAY_MS = 24 * 60 * 60 * 1000

export default function AiForecast({ symbol }) {
  const [forecast, setForecast] = useState(null)
  const [generatedAt, setGeneratedAt] = useState(null)
  const [scenario, setScenario] = useState('expected')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const loadedRef = useRef(false)

  // A cached forecast shows immediately; generating is always explicit.
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    readAiCache('forecast').then((row) => {
      if (row?.value) {
        setForecast(row.value)
        setGeneratedAt(row.generatedAt)
      }
    })
  }, [])

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const fingerprint = await dataFingerprint()
      const cached = await readAiCache('forecast')
      // Cached per day unless the books moved.
      const fresh =
        cached &&
        cached.dataHash === fingerprint &&
        Date.now() - new Date(cached.generatedAt).getTime() < DAY_MS

      if (fresh) {
        setForecast(cached.value)
        setGeneratedAt(cached.generatedAt)
        return
      }

      const context = await buildFinancialContext(6)
      const raw = await callGroq({
        model: MODEL_DEFAULT,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Business data:\n${context}` }],
        temperature: 0.1,
        maxTokens: 600,
        jsonMode: true,
      })

      const parsed = parseJsonLoose(raw)
      if (!parsed?.scenarios?.expected) {
        throw Object.assign(new Error('No scenarios returned'), { code: 'PARSE' })
      }

      const row = await writeAiCache('forecast', parsed, fingerprint)
      setForecast(parsed)
      setGeneratedAt(row.generatedAt)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  const active = forecast?.scenarios?.[scenario]
  const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

  return (
    <section className="bfh-card bfh-forecast">
      <header className="bfh-forecast__head">
        <div>
          <h2 className="bfh-panel__title">AI forecast</h2>
          <div className="bfh-micro">
            {generatedAt ? `Generated ${timeAgo(generatedAt)}` : 'Not generated yet'}
          </div>
        </div>

        <button type="button" className="bfh-ghostaction" onClick={generate} disabled={loading}>
          {forecast ? (
            <IconRefresh size={12} stroke={1.5} aria-hidden="true" />
          ) : (
            <IconSparkles size={12} stroke={1.5} aria-hidden="true" />
          )}
          {forecast ? 'Regenerate' : 'Generate AI forecast'}
        </button>
      </header>

      {loading && <AiLoading label="Forecasting" />}
      {error && <AiError error={error} onRetry={generate} />}

      {active && !loading && (
        <>
          <div className="bfh-periods bfh-forecast__tabs" role="group" aria-label="Scenario">
            {SCENARIOS.map((id) => (
              <button
                key={id}
                type="button"
                className="bfh-period"
                aria-pressed={scenario === id}
                onClick={() => setScenario(id)}
                disabled={!forecast.scenarios[id]}
              >
                {id}
              </button>
            ))}
          </div>

          <div className="bfh-summary bfh-summary--4">
            <div className="bfh-summary__cell">
              <span className="bfh-micro">Monthly revenue</span>
              <span className="bfh-summary__value">
                {formatCurrency(num(active.monthlyRevenue), symbol)}
              </span>
            </div>
            <div className="bfh-summary__cell">
              <span className="bfh-micro">Monthly expenses</span>
              <span className="bfh-summary__value">
                {formatCurrency(num(active.monthlyExpenses), symbol)}
              </span>
            </div>
            <div className="bfh-summary__cell">
              <span className="bfh-micro">Monthly profit</span>
              <span className="bfh-summary__value">
                {formatCurrency(num(active.monthlyProfit), symbol)}
              </span>
            </div>
            <div className="bfh-summary__cell">
              <span className="bfh-micro">Runway</span>
              <span className="bfh-summary__value">
                {num(active.runwayMonths).toFixed(1)} months
              </span>
              <span className="bfh-micro">
                ending {formatCurrency(num(active.endingCash), symbol)}
              </span>
            </div>
          </div>

          {active.recommendation && (
            <p className="bfh-forecast__note">{active.recommendation}</p>
          )}

          <footer className="bfh-forecast__foot">
            {forecast.confidence && (
              <span className="bfh-chip">{forecast.confidence} confidence</span>
            )}
            {Array.isArray(forecast.basedOn) && forecast.basedOn.length > 0 && (
              <ul className="bfh-forecast__basis">
                {forecast.basedOn.slice(0, 6).map((item) => (
                  <li key={item} className="bfh-micro">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </footer>
        </>
      )}
    </section>
  )
}
