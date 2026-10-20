import {
  IconArrowRight,
  IconArrowUp,
  IconBuilding,
  IconMessagePlus,
  IconLoader2,
  IconMicrophone,
  IconMicrophoneOff,
  IconPlayerStopFilled,
  IconSparkles,
  IconUser,
  IconX,
} from '@tabler/icons-react'
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
import { readMethods } from '../../lib/methodStore'
import { parseAIResponse } from '../../lib/parseAIResponse'
import { editTarget, navigateTarget, prepareCards, saveCard } from '../../lib/actionCards'
import Delta from '../Delta'
import ActionConfirmCard from './ActionConfirmCard'
import useFocusTrap from '../../hooks/useFocusTrap'
import useSettings from '../../hooks/useSettings'
import useSpeechRecognition from '../../hooks/useSpeechRecognition'

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

/* Things the assistant can write, worded as someone would type them. Tapping
   one puts it in the box rather than sending it — the figures are examples,
   and the person should make them their own first. */
const RECORD_EXAMPLES = {
  business: ['Log client payment 45000', 'Invoice Acme 15000 for web design', 'Set marketing budget to 20k'],
  personal: ['Add 500 sa food', 'Nag-ipon ako ng 2k sa emergency fund', 'Laptop goal 50k by December'],
}

/* One thread per side for as long as the app is open. Closing the panel no
   longer throws the conversation away, and switching sides brings back the
   thread that belongs to that side instead of mixing the two. */
const threads = { business: [], personal: [] }

const MODE_LABEL = { business: 'Business data', personal: 'Personal data' }

/**
 * The model writes for a reader, not for a parser. The formatting rules are
 * blunt on purpose: earlier replies arrived full of asterisks that rendered as
 * literal symbols, so the prompt now forbids markdown outright and the answer
 * still goes through a renderer as a second line of defence.
 */
const systemPrompt = (context, categories, profile, methods = []) =>
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
{"stats":[{"label":string,"value":string,"change":number,"goodWhen":"up"|"down"}],"followUps":[string,string,string]}

stats = up to 4 key numbers from your answer.
Only when a stat compares against an earlier period, add "change" (the % change as a plain number, negative for a fall, e.g. -12.5) and "goodWhen" ("up" if a rise is good news, like income or savings; "down" if a fall is, like spending). Leave both out otherwise — never guess a change.
followUps = 3 short follow-up questions the user might ask next.
If there are no relevant stats, use an empty array: {"stats":[],"followUps":[...]}

ACTION DETECTION:
If the user wants to add, log, or record a transaction (in any language — English, Filipino, or Taglish), extract the details and add an "action" key to your JSON output:

{
  "stats": [],
  "followUps": [],
  "action": {
    "type": "ADD_TRANSACTION",
    "saveMode": "direct",
    "prefill": {
      "description": string,
      "amount": number (always positive),
      "txType": "expense" | "income",
      "category": string (must be one of the categories listed below),
      "date": "YYYY-MM-DD (today if not stated)",
      "paymentMethod": string (one of the payment methods listed below, or ""),
      "notes": string
    }
  }
}

For transaction requests use saveMode "direct". Direct save shows the user a confirmation card in the chat, and nothing is saved until they approve it.
Only use saveMode "modal" if the user explicitly asks to open the form.

If the user wants to add several transactions in one message, return an "actions" array instead of a single "action" — one entry per transaction, each with the same shape:
{"stats":[],"followUps":[],"actions":[{"type":"ADD_TRANSACTION","saveMode":"direct","prefill":{...}},{"type":"ADD_TRANSACTION","saveMode":"direct","prefill":{...}}]}
Use "actions" (plural) for more than one transaction and "action" (singular) for one.

For a transaction reply, the one sentence confirms what you understood, such as "Got it — ₱500 for food." Never say it has been saved: the user still has to confirm it.
Good followUps after a transaction: "What's my balance now?", "Add another expense", "Show my recent transactions".

Expense categories: ${categories.expense.join(', ')}
Income categories: ${categories.income.join(', ')}
Use only these exact names. If none fit, use an empty string.

Payment methods: ${methods.length ? methods.join(', ') : 'none saved yet'}
If the user says how they paid ("paid via GCash", "sa Maya"), put that method's exact name from this list in paymentMethod. If they did not say, or it is not on the list, use an empty string. Never invent a payment method.

Every action is recorded against the profile that is loaded: ${profile}.

OTHER ACTIONS:
The same "action" / "actions" keys carry every kind of record below. Every one uses saveMode "direct" and is shown to the user as a confirmation card; nothing is saved until they approve it. Only include fields you can read from the message.

Savings goals (Personal) — the user names a goal, a target, a deadline:
  "mag-ipon ako ng 50k para sa laptop by December", "set a goal for emergency fund 100k", "update my travel fund target to 80k"
  {"type":"UPDATE_GOAL","saveMode":"direct","prefill":{"name":string,"targetAmount":number,"currentAmount":number,"deadline":"YYYY-MM-DD" or null}}

Savings deposits (Personal) — money put toward a named goal:
  "nag-ipon ako ng 2k sa travel fund", "added 5000 to emergency fund"
  {"type":"ADD_SAVINGS_ENTRY","saveMode":"direct","prefill":{"goalName":string,"amount":number,"date":"YYYY-MM-DD"}}

Budgets (Business) — a spending limit for an expense category:
  "set my marketing budget to 20k", "add a budget for utilities 3000"
  {"type":"SET_BUDGET","saveMode":"direct","prefill":{"category":string (a business expense category),"limit":number,"period":"monthly" | "quarterly" | "yearly"}}

Invoices (Business) — billing a client:
  "mag-invoice ako kay John 15000 for web design", "create invoice for Santos Corp 50000 due next Friday"
  {"type":"ADD_INVOICE","saveMode":"direct","prefill":{"clientName":string,"amount":number (before tax),"description":string,"dueDate":"YYYY-MM-DD" or null}}

Clients (Business):
  "add client Maria Santos, maria@santos.com", "new client: Acme Corp, 09171234567"
  {"type":"ADD_CLIENT","saveMode":"direct","prefill":{"name":string,"email":string or null,"phone":string or null,"company":string or null}}

Transfers — the owner paying themselves from the business:
  "mag-transfer ng 20k mula business papunta personal", "i-salary ko yung 15000 sa personal", "owner draw of 10000"
  {"type":"ADD_TRANSFER","saveMode":"direct","prefill":{"amount":number,"date":"YYYY-MM-DD","notes":string}}

Net worth (Personal) — an asset or a debt:
  "I bought a car worth 450000", "I have a credit card debt of 35000", "update my BDO savings to 62000"
  {"type":"UPDATE_NET_WORTH","saveMode":"direct","prefill":{"label":string,"value":number,"entryType":"asset" | "liability","category":string}}
  Asset categories: Cash & Savings, Investments, Property, Other. Liability categories: Loans, Credit Cards, Other Debt.

Navigation — the user only wants to open a page. No card:
  {"type":"NAVIGATE","route":"/goals" | "/budgets" | "/invoices" | "/clients" | "/net-worth" | "/reports" | "/transactions" | "/income" | "/expenses" | "/cashflow" | "/dashboard"}

These records may belong to the other profile than the one loaded; still return the action — the card says which side it saves to.

Good followUps after each action:
  UPDATE_GOAL: "How close am I to this goal?", "Show all my goals", "Add money to this goal"
  ADD_SAVINGS_ENTRY: "How much more do I need?", "Show goal progress", "Add another deposit"
  SET_BUDGET: "Show my budgets", "How am I tracking this month?", "Set another budget"
  ADD_INVOICE: "Show all invoices", "Create another invoice"
  ADD_CLIENT: "Create an invoice for them", "Show all clients"
  ADD_TRANSFER: "Show personal balance", "Show business cash flow"
  UPDATE_NET_WORTH: "What's my net worth now?", "Add another asset", "Add a liability"

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
    <span className="bfh-assist__thinking" role="status">
      <span className="bfh-assist__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      Looking at your numbers
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

/**
 * The cards for one reply, with a "Save all" above them when more than one is
 * ready to save. A card with a problem has to go through its form, so it is
 * never part of the batch.
 */
function ConfirmCards({ cards, symbol, categoryIcons, canEdit, onSave, onSaveAll, onEdit, onDismiss }) {
  const ready = cards.filter((c) => (c.status === 'pending' || c.status === 'error') && !c.problem)

  return (
    <div className="bfh-confirmlist">
      {ready.length > 1 && (
        <button type="button" className="bfh-confirm__saveall" onClick={() => onSaveAll(ready)}>
          Save all {ready.length}
        </button>
      )}
      {cards.map((card) => (
        <ActionConfirmCard
          key={card.id}
          card={card}
          symbol={symbol}
          categoryIcons={categoryIcons}
          canEdit={canEdit(card)}
          onSave={() => onSave(card)}
          onEdit={onEdit}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  )
}

export default function AIAssistant({ onClose }) {
  const navigate = useNavigate()
  const { triggerAction } = useAssistantActions()
  // Which books are loaded. Everything below follows from it: the data, the
  // prompt, the suggestions, and the pill that tells the user which it is.
  const { profile, switchProfile, activeMode } = useProfile()
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

  const categoryIcons = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.name, c.icon])),
    [categories],
  )
  const transactionsPath = profile === 'personal' ? '/personal/transactions' : '/transactions'

  const settings = useSettings()

  const [messages, setMessages] = useState(() => threads[profile] ?? [])
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
  // The tax rate and invoice defaults a card needs; read the same way.
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  // Read inside `ask` without making it depend on every keystroke.
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  // Switching sides swaps threads: the answers on screen were about the other
  // set of books, and the digest the model was given describes money this
  // side does not have. Each side gets back its own conversation, so nothing
  // stale is left to be read against the next question.
  const threadOwner = useRef(profile)
  useEffect(() => {
    if (threadOwner.current === profile) return
    threadOwner.current = profile
    abortRef.current?.abort()
    contextRef.current = null
    setInput('')
    setMessages(threads[profile] ?? [])
  }, [profile])

  // Kept in step on every change, against the side the thread belongs to.
  useEffect(() => {
    threads[threadOwner.current] = messages
  }, [messages])

  const newChat = () => {
    abortRef.current?.abort()
    clearTimeout(actionTimerRef.current)
    contextRef.current = null
    setMessages([])
    setInput('')
    inputRef.current?.focus()
  }

  const stop = () => abortRef.current?.abort()

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

  // A short answer scrolls fully into view. A long one would scroll past its
  // own opening, so the question that prompted it is pinned to the top and
  // the answer reads from its first line.
  useEffect(() => {
    const box = scrollRef.current
    if (!box) return
    const asks = box.querySelectorAll('.bfh-assist__ask')
    const lastAsk = asks[asks.length - 1]
    const tail = lastAsk ? box.scrollHeight - lastAsk.offsetTop : 0
    const top = lastAsk && tail > box.clientHeight ? lastAsk.offsetTop - 12 : box.scrollHeight
    box.scrollTo({ top, behavior: 'smooth' })
  }, [messages, loading])

  // The box grows with what is typed, up to five lines, then scrolls.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

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
      // Read fresh each time: a method added a moment ago in Settings counts.
      const methods = (await readMethods()).filter((m) => m.active)

      const controller = new AbortController()
      abortRef.current = controller

      const raw = await callGroq({
        model: MODEL_DEFAULT,
        system: systemPrompt(contextRef.current, categoryNames, profile, methods.map((m) => m.name)),
        // The model only ever sees role and content; the parsed extras are ours.
        messages: history.map(({ role, content }) => ({ role, content })),
        temperature: 0.3,
        maxTokens: 800,
        signal: controller.signal,
      })

      const { text: answer, stats, followUps, action, actions } = parseAIResponse(raw)
      const requested = actions.length ? actions : action ? [action] : []

      // Anything that writes becomes a card in the thread: the person sees
      // exactly what would be saved and confirms it there. Nothing is written
      // until they do. Two things skip the card — an explicit request for the
      // transaction form ("modal"), and plain navigation.
      const cards = await prepareCards(
        requested.filter((a) => a?.type !== 'NAVIGATE' && a?.saveMode !== 'modal'),
        { profile, activeMode, categories: categoriesRef.current, settings: settingsRef.current, methods },
      )

      setMessages([...history, { role: 'assistant', content: answer, stats, followUps, cards }])

      const toForm = requested.find((a) => a?.type === 'ADD_TRANSACTION' && a?.saveMode === 'modal')
      const prefill = toForm ? normalizeAction(toForm, categoriesRef.current, methods) : null
      const route = requested.find((a) => a?.type === 'NAVIGATE')
      const destination = route ? navigateTarget(route.route, profile) : null

      if (prefill) {
        actionTimerRef.current = setTimeout(() => {
          triggerAction({ type: 'ADD_TRANSACTION', prefill })
          navigate(transactionsPath)
          onClose()
        }, 700)
      } else if (destination && (activeMode === 'both' || activeMode === destination.side)) {
        // Long enough to read the one-line reply, then straight there.
        actionTimerRef.current = setTimeout(() => {
          if (destination.side !== profile) switchProfile(destination.side)
          navigate(destination.path)
          onClose()
        }, 600)
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
  }, [loading, categoryNames, profile, activeMode, switchProfile, triggerAction, navigate, onClose, transactionsPath])

  /* ---- Confirmation cards -------------------------------------------------
     Each card is addressed by the reply it sits in and its own id, so cards in
     one reply save, fail and dismiss independently. */

  const patchCard = useCallback((messageIndex, cardId, patch) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === messageIndex && m.cards
          ? { ...m, cards: m.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)) }
          : m,
      ),
    )
  }, [])

  const confirmCard = async (messageIndex, card) => {
    patchCard(messageIndex, card.id, { status: 'saving' })
    try {
      await saveCard(card)
      patchCard(messageIndex, card.id, { status: 'saved' })
    } catch (err) {
      console.error('Saving the confirmed card failed', err)
      patchCard(messageIndex, card.id, { status: 'error' })
    }
  }

  // One after another, so every card before a failure is genuinely saved and
  // the failed one says so on its own card.
  const saveAll = async (messageIndex, cards) => {
    for (const card of cards) {
      await confirmCard(messageIndex, card)
    }
  }

  // A card can only hand off to a form that exists on a side that is on.
  const canEdit = (card) => {
    const target = editTarget(card, profile)
    return Boolean(target) && (activeMode === 'both' || activeMode === target.side)
  }

  // The full form takes over, on whichever side it lives; this card steps
  // aside so the same record cannot also be saved from here.
  const editCard = (messageIndex, card) => {
    const target = editTarget(card, profile)
    if (!target) return
    patchCard(messageIndex, card.id, { status: 'dismissed' })
    if (target.side !== profile) switchProfile(target.side)
    triggerAction(target.action)
    navigate(target.path)
    onClose()
  }

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

  /* ---- Dictation ---------------------------------------------------------
     One tap, one phrase. The hook closes the mic at the first pause and only
     hands over a phrase that was clearly said; it lands in the box, so the
     person sees what was heard, and is asked straight away — the same as
     pressing send. */

  const askRef = useRef(ask)
  askRef.current = ask

  const voice = useSpeechRecognition({
    enabled: settings.voiceInput ?? true,
    onTranscript: (text) => {
      setInput(text)
      askRef.current(text)
    },
  })

  const toggleVoice = () => {
    if (voice.listening) {
      voice.stop()
      inputRef.current?.focus()
      return
    }
    // Starting from a focused field would raise the keyboard over the panel on
    // a phone, which is the one place the microphone is most use.
    inputRef.current?.blur()
    voice.start()
  }

  const micBroken = ['silent', 'blocked', 'offline', 'nomic', 'error'].includes(voice.status)

  const empty = messages.length === 0
  const lastReply = messages.reduce((last, m, i) => (m.role === 'assistant' ? i : last), -1)

  /* Portalled to the body: the entrance animation on `.bfh-block` leaves an
     identity transform behind, which would otherwise become this fixed
     overlay's containing block. */
  return createPortal(
    <div className="bfh-assist" role="dialog" aria-modal="true" aria-label="Ask Dual">
      <button type="button" className="bfh-assist__scrim" aria-label="Close" onClick={onClose} />

      <div className="bfh-assist__panel" ref={trapRef}>
        <span className="bfh-assist__grip" aria-hidden="true" />

        <header className="bfh-assist__head">
          <span className="bfh-assist__brand">
            {/* The same mark the sidebar and the home-screen icon carry, so the
                assistant reads as part of Dual rather than a bolted-on bot. */}
            <img className="bfh-assist__mark" src="/favicon.svg" alt="" width="32" height="32" />

            <span className="bfh-assist__titles">
              <span className="bfh-assist__title">Ask Dual</span>
              {/* Says which books are loaded before a question is even typed —
                  the one thing that stops a right answer being read as a
                  wrong one. */}
              <span className="bfh-assist__subtitle">
                {MODE_LABEL[profile] ?? MODE_LABEL.business}
              </span>
            </span>
          </span>

          <span className="bfh-assist__headright">
            {/* One control that both shows the loaded side and changes it,
                in place of a label and a separate "switch" link. A one-sided
                setup has nothing to switch to, so it gets neither. */}
            {activeMode === 'both' && (
              <span className="bfh-assist__sides" role="radiogroup" aria-label="Which data to use">
                {['business', 'personal'].map((side) => (
                  <button
                    key={side}
                    type="button"
                    role="radio"
                    className="bfh-assist__side"
                    aria-checked={profile === side}
                    onClick={() => profile !== side && switchProfile(side)}
                    title={MODE_LABEL[side]}
                  >
                    {side === 'personal' ? (
                      <IconUser size={13} stroke={1.75} aria-hidden="true" />
                    ) : (
                      <IconBuilding size={13} stroke={1.75} aria-hidden="true" />
                    )}
                    <span className="bfh-assist__sidelabel">
                      {side === 'personal' ? 'Personal' : 'Business'}
                    </span>
                  </button>
                ))}
              </span>
            )}

            {!empty && (
              <button
                type="button"
                className="bfh-assist__headbtn"
                onClick={newChat}
                aria-label="New chat"
                title="New chat"
              >
                <IconMessagePlus size={17} stroke={1.5} aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              className="bfh-assist__headbtn"
              onClick={onClose}
              aria-label="Close assistant"
              title="Close (Esc)"
            >
              <IconX size={17} stroke={1.5} aria-hidden="true" />
            </button>
          </span>
        </header>

        {empty ? (
          <div className="bfh-assist__suggest">
            <div className="bfh-assist__hello">
              <p className="bfh-assist__hellotitle">What would you like to know?</p>
              <p className="bfh-assist__hellobody">
                Ask about your {profile === 'personal' ? 'personal' : 'business'} money in plain words — English,
                Filipino or Taglish. You can also tell it to record something; you will see it before anything
                is saved.
              </p>
            </div>

            <span className="bfh-assist__eyebrow">Ask</span>
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

            <span className="bfh-assist__eyebrow">Record</span>
            <div className="bfh-assist__examples">
              {(RECORD_EXAMPLES[profile] ?? RECORD_EXAMPLES.business).map((example) => (
                <button
                  key={example}
                  type="button"
                  className="bfh-assist__chip"
                  onClick={() => {
                    setInput(example)
                    inputRef.current?.focus()
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
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
                              {Number.isFinite(stat.change) && (
                                <Delta value={stat.change} goodWhen={stat.goodWhen === 'down' ? 'down' : 'up'} />
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {message.cards?.length > 0 && (
                        <ConfirmCards
                          cards={message.cards}
                          symbol={settings.symbol}
                          categoryIcons={categoryIcons}
                          canEdit={canEdit}
                          onSave={(card) => confirmCard(index, card)}
                          onSaveAll={(cards) => saveAll(index, cards)}
                          onEdit={(card) => editCard(index, card)}
                          onDismiss={(cardId) => patchCard(index, cardId, { status: 'dismissed' })}
                        />
                      )}

                      {/* Earlier suggestions have been overtaken by the
                          conversation; only the latest answer offers any. */}
                      {index === lastReply && !loading && message.followUps.length > 0 && (
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
          <textarea
            ref={inputRef}
            rows={1}
            className="bfh-assist__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={voice.listening ? 'Speak now…' : 'Ask or record something…'}
            aria-label="Ask anything about your finances"
          />

          {/* Absent rather than disabled where the browser has no recogniser:
              a dead microphone invites a tap that can never work. */}
          {voice.supported && (
            <button
              type="button"
              className="bfh-assist__mic"
              data-status={voice.status}
              onClick={toggleVoice}
              aria-pressed={voice.listening}
              aria-label={voice.listening ? 'Stop listening' : 'Ask by voice'}
              title={voice.listening ? 'Tap to stop' : 'Tap to speak'}
            >
              {voice.status === 'processing' ? (
                <IconLoader2 className="bfh-assist__spin" size={17} stroke={2} aria-hidden="true" />
              ) : micBroken ? (
                <IconMicrophoneOff size={17} stroke={2} aria-hidden="true" />
              ) : (
                <IconMicrophone size={17} stroke={2} aria-hidden="true" />
              )}
            </button>
          )}

          {loading ? (
            <button type="button" className="bfh-assist__send" onClick={stop} aria-label="Stop answering">
              <IconPlayerStopFilled size={13} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="bfh-assist__send"
              onClick={() => ask(input)}
              disabled={!input.trim()}
              aria-label="Send"
            >
              <IconArrowUp size={17} stroke={2} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* What the microphone is doing, in words, for as long as it is doing
            something — and why it stopped, when it stops on its own. */}
        {voice.message && (
          <p className="bfh-assist__voicestatus" data-status={voice.status} role="status">
            {voice.message}
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}
