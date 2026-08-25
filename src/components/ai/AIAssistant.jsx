import { IconArrowRight, IconArrowUp, IconBuilding, IconSparkles, IconUser, IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'

import { useAssistantActions } from '../../context/AssistantActionsContext'
import { db } from '../../db/db'
import { useProfile } from '../../context/ProfileContext'
import { ofProfile } from '../../db/queries'
import { buildFinancialContext, callGroq, MODEL_DEFAULT } from '../../lib/ai'
import { normalizeAction } from '../../lib/assistantAction'
import { parseAIResponse } from '../../lib/parseAIResponse'
import useFocusTrap from '../../hooks/useFocusTrap'

const SUGGESTIONS = {
  business: [
    'How much did I spend this month?',
    'Which client owes me the most?',
    'What does my cash runway look like?',
    'Show me my top expense categories.',
  ],
  personal: [
    "What's my savings rate this month?",
    'How am I tracking on my goals?',
    'Where am I spending the most?',
    "What's my current net worth?",
  ],
}

const MODE_LABEL = { business: 'Business data', personal: 'Personal data' }

/**
 * The model writes for a reader, not for a parser. The formatting rules are
 * blunt on purpose: earlier replies arrived full of asterisks that rendered as
 * literal symbols, so the prompt now forbids markdown outright and the answer
 * still goes through a renderer as a second line of defence.
 */
const systemPrompt = (context, categories, profile) =>
  `You are a financial assistant built into Dual Finance, a business and personal finance app for small Philippine businesses and households.

The user is currently viewing their ${profile === 'personal' ? 'PERSONAL' : 'BUSINESS'} finances, and the data below is that profile only.
Answer every question using only that data — never guess, never make up numbers, and never mix business and personal figures.

STRICT FORMATTING RULES:
- Write in short, clean sentences. Plain English only.
- Never use asterisks, underscores, or any markdown symbols.
- Never write **bold** or __underline__ — these show as raw symbols.
- Use a dash ( - ) for lists, nothing else.
- Keep responses short and direct. Maximum 4 sentences of explanation.
- Always end with the JSON block on its own line — no extra text after it.
- Numbers: always include the ₱ symbol. Use commas for thousands.

RESPONSE STRUCTURE:
Write your plain text answer first.
Then on a new line, output only this JSON — nothing before or after it:
{"stats":[{"label":string,"value":string}],"followUps":[string,string,string]}

stats = up to 4 key numbers from your answer.
followUps = 3 short follow-up questions the user might ask next.
If there are no relevant stats, use an empty array: {"stats":[],"followUps":[...]}

ACTION DETECTION:
If the user wants to add, log, or record a transaction (in any language — English, Filipino, or Taglish), extract the details and add an "action" key to your JSON output:

{
  "stats": [],
  "followUps": [],
  "action": {
    "type": "ADD_TRANSACTION",
    "prefill": {
      "description": string,
      "amount": number (always positive),
      "txType": "expense" | "income",
      "category": string (must be one of the categories listed below),
      "date": "YYYY-MM-DD (today if not stated)",
      "notes": string
    }
  }
}

Expense categories: ${categories.expense.join(', ')}
Income categories: ${categories.income.join(', ')}
Use only these exact names. If none fit, use an empty string.

Every action is recorded against the profile that is loaded: ${profile}.

Personal phrasings that mean an expense: gastos ko, binayad ko, nag bayad ako, nautang ko.
Personal phrasings that mean income: sweldo, natanggap ko, kita ko, freelance payment.

If no action needed, omit the action key. Never invent an action for a question
that is only asking about existing data.
Always reply in English. Keep the reply to one sentence for actions.

CROSS-PROFILE QUESTIONS:
Business-only subjects: invoices, clients, revenue, profit and loss, receivables,
payroll, VAT, cash runway, retainers.
Personal-only subjects: savings rate, net worth, savings goals, household spending,
debt payments, emergency fund.

You have ${profile} data loaded. If the question is about a subject belonging to
the other profile, do not answer it from the data you have and do not guess.
Say which data you have, name what they asked about, and tell them to switch:
"I have your ${profile} data loaded. [What they asked about] is in your ${profile === 'personal' ? 'Business' : 'Personal'} data. Switch to ${profile === 'personal' ? 'Business' : 'Personal'} mode to see it."
Return no action for those questions.

If a figure is genuinely zero or empty, say so as a fact rather than as a missing
feature — "you have not recorded any income this month yet", not "no data available".

LANGUAGE: Understand English, Filipino, and Taglish equally.
Examples:
  'add 500 sa truck'         → expense, transport category, 500
  'log client payment 45000' → income, client payment category, 45000
  'nag bayad si client 8000' → income, client payment category, 8000
  'gastos ko 1500 food'      → expense, meals category, 1500

Financial data:
${context}`

/**
 * What to say when a request fails. Which provider is behind the assistant is
 * not the reader's problem, so nothing here names one — only the cases they can
 * actually act on say more than the default.
 */
const ERROR_NOTE = {
  NO_API_KEY: 'The assistant is not set up on this device yet.',
  INVALID_KEY: 'The assistant is not set up correctly on this device.',
  RATE_LIMIT: 'Too many questions at once. Try again in a moment.',
}
const errorNote = (err) => ERROR_NOTE[err?.code] ?? 'Something went wrong. Try again.'

/** Three dots, staggered, while the model is thinking. */
function Thinking() {
  return (
    <span className="bfh-assist__dots" role="status" aria-label="Thinking">
      <span />
      <span />
      <span />
    </span>
  )
}

function AiLabel() {
  return (
    <span className="bfh-assist__who">
      <IconSparkles size={11} stroke={1.5} aria-hidden="true" />
      Dual
    </span>
  )
}

export default function AIAssistant({ onClose }) {
  const navigate = useNavigate()
  const { triggerAction } = useAssistantActions()
  // Which books are loaded. Everything below follows from it: the data, the
  // prompt, the suggestions, and the pill that tells the user which it is.
  const { profile, switchProfile } = useProfile()
  // The model can only pick a category that exists, so it gets the real list.
  const categories = useLiveQuery(
    () => db.categories.orderBy('name').filter(ofProfile(profile)).toArray(),
    [profile],
    [],
  )
  const categoryNames = useMemo(
    () => ({
      expense: categories.filter((c) => c.type === 'expense').map((c) => c.name),
      income: categories.filter((c) => c.type === 'income').map((c) => c.name),
    }),
    [categories],
  )

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const inputRef = useRef(null)
  const scrollRef = useRef(null)
  const trapRef = useFocusTrap()
  // Built once per session — the books do not move while the panel is open.
  const contextRef = useRef(null)
  const abortRef = useRef(null)
  const actionTimerRef = useRef(null)
  // Read inside `ask` without adding a dependency that changes on every query.
  const categoriesRef = useRef(categories)
  categoriesRef.current = categories
  // Read inside `ask` without making it depend on every keystroke.
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  // Switching profiles mid-conversation invalidates everything said so far:
  // the answers above were about the other set of books, and the digest the
  // model was given describes money this profile does not have. The thread is
  // cleared and the switch is stated, rather than leaving stale figures on
  // screen for the next question to be read against.
  const firstProfile = useRef(profile)
  useEffect(() => {
    if (firstProfile.current === profile) return
    firstProfile.current = profile
    contextRef.current = null
    setInput('')
    setMessages([
      { role: 'system', content: `Switched to ${profile === 'personal' ? 'Personal' : 'Business'} data.` },
    ])
  }, [profile])

  useEffect(() => {
    inputRef.current?.focus()
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      abortRef.current?.abort()
      clearTimeout(actionTimerRef.current)
    }
  }, [onClose])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  /**
   * `base` lets a retry rewind to the turn before the failure instead of
   * appending the same question a second time.
   */
  const ask = useCallback(async (question, base) => {
    const text = question.trim()
    if (!text || loading) return

    const history = [...(base ?? messagesRef.current), { role: 'user', content: text }]
    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      if (!contextRef.current) contextRef.current = await buildFinancialContext(profile, 3)

      const controller = new AbortController()
      abortRef.current = controller

      const raw = await callGroq({
        model: MODEL_DEFAULT,
        system: systemPrompt(contextRef.current, categoryNames, profile),
        // The model only ever sees role and content; the parsed extras are ours.
        messages: history.map(({ role, content }) => ({ role, content })),
        temperature: 0.3,
        maxTokens: 800,
        signal: controller.signal,
      })

      const { text: answer, stats, followUps, action } = parseAIResponse(raw)
      setMessages([...history, { role: 'assistant', content: answer, stats, followUps }])

      // Hand the extracted fields to the Add Transaction form and step out of
      // the way. Nothing is written here — the person still has to save.
      const prefill = normalizeAction(action, categoriesRef.current)
      if (prefill) {
        actionTimerRef.current = setTimeout(() => {
          triggerAction({ type: 'ADD_TRANSACTION', prefill })
          navigate('/transactions')
          onClose()
        }, 700)
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      setMessages([
        ...history,
        { role: 'assistant', content: '', stats: [], followUps: [], error: errorNote(err) },
      ])
    } finally {
      setLoading(false)
    }
  }, [loading, categoryNames, triggerAction, navigate, onClose])

  /** Drop the failed reply and put the same question back on the wire. */
  const retry = () => {
    const withoutFailure = messagesRef.current.slice(0, -1)
    const lastUser = withoutFailure[withoutFailure.length - 1]
    if (lastUser?.role !== 'user') return
    ask(lastUser.content, withoutFailure.slice(0, -1))
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ask(input)
    }
  }

  const empty = messages.length === 0

  /* Portalled to the body: the entrance animation on `.bfh-block` leaves an
     identity transform behind, which would otherwise become this fixed
     overlay's containing block. */
  return createPortal(
    <div className="bfh-assist" role="dialog" aria-modal="true" aria-label="Ask Dual">
      <button type="button" className="bfh-assist__scrim" aria-label="Close" onClick={onClose} />

      <div className="bfh-assist__panel" ref={trapRef}>
        <span className="bfh-assist__grip" aria-hidden="true" />

        <header className="bfh-assist__head">
          <span className="bfh-assist__title">
            <IconSparkles size={14} stroke={1.5} aria-hidden="true" />
            Ask Dual
          </span>

          <span className="bfh-assist__headright">
            {/* Says which books are loaded before a question is even typed —
                the one thing that stops a right answer being read as a wrong
                one. */}
            <span className="bfh-assist__mode">
              {profile === 'personal' ? (
                <IconUser size={11} stroke={1.5} aria-hidden="true" />
              ) : (
                <IconBuilding size={11} stroke={1.5} aria-hidden="true" />
              )}
              {MODE_LABEL[profile] ?? MODE_LABEL.business}
            </span>

            <button
              type="button"
              className="bfh-assist__switch"
              onClick={() => switchProfile(profile === 'personal' ? 'business' : 'personal')}
            >
              Switch →
            </button>

            <span className="bfh-assist__esc" aria-hidden="true">
              Esc
            </span>
            <button
              type="button"
              className="bfh-iconaction"
              onClick={onClose}
              aria-label="Close assistant"
            >
              <IconX size={16} stroke={1.5} aria-hidden="true" />
            </button>
          </span>
        </header>

        {empty ? (
          <div className="bfh-assist__suggest">
            <span className="bfh-assist__eyebrow">Try asking</span>
            {(SUGGESTIONS[profile] ?? SUGGESTIONS.business).map((question) => (
              <button
                key={question}
                type="button"
                className="bfh-assist__suggestion"
                onClick={() => ask(question)}
              >
                <span>{question}</span>
                <IconArrowRight size={12} stroke={1.5} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <div className="bfh-assist__thread" ref={scrollRef}>
            {messages.map((message, index) =>
              message.role === 'system' ? (
                // eslint-disable-next-line react/no-array-index-key
                <p className="bfh-assist__system" key={index}>
                  — {message.content} —
                </p>
              ) : message.role === 'user' ? (
                // eslint-disable-next-line react/no-array-index-key
                <p className="bfh-assist__ask" key={index}>
                  {message.content}
                </p>
              ) : (
                // eslint-disable-next-line react/no-array-index-key
                <div className="bfh-assist__reply" key={index}>
                  <AiLabel />

                  {message.error ? (
                    <>
                      <p className="bfh-assist__error">{message.error}</p>
                      <button type="button" className="bfh-assist__retry" onClick={retry}>
                        Try again
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="ai-text">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>

                      {message.stats.length > 0 && (
                        <div className="bfh-assist__stats">
                          {message.stats.map((stat) => (
                            <span className="bfh-assist__stat" key={stat.label + stat.value}>
                              <span className="bfh-assist__statvalue">{stat.value}</span>
                              <span className="bfh-assist__statlabel">{stat.label}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {message.followUps.length > 0 && (
                        <div className="bfh-assist__chips">
                          {message.followUps.map((question) => (
                            <button
                              key={question}
                              type="button"
                              className="bfh-assist__chip"
                              onClick={() => ask(question)}
                            >
                              {question}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ),
            )}

            {loading && (
              <div className="bfh-assist__reply">
                <AiLabel />
                <Thinking />
              </div>
            )}
          </div>
        )}

        <div className="bfh-assist__inputrow">
          <input
            ref={inputRef}
            className="bfh-assist__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask anything about your finances…"
            aria-label="Ask anything about your finances"
          />

          <button
            type="button"
            className="bfh-assist__send"
            onClick={() => ask(input)}
            disabled={loading || !input.trim()}
            aria-label="Send"
          >
            <IconArrowUp size={13} stroke={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
