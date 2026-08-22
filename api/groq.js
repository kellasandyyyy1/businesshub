/**
 * Serverless proxy for the assistant.
 *
 * The browser must never hold the API key: anything Vite inlines with a VITE_
 * prefix ships inside the JavaScript bundle, where a deployed site hands it to
 * anyone who opens devtools. This function keeps the key on the server and
 * passes the conversation through.
 *
 * Set GROQ_API_KEY in the Vercel project — note the missing VITE_ prefix, which
 * is exactly what keeps it out of the bundle.
 */

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

/** Only the fields the client is allowed to choose. */
const ALLOWED = ['model', 'messages', 'max_tokens', 'temperature', 'response_format', 'reasoning_effort']

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const key = process.env.GROQ_API_KEY
  if (!key) {
    return res.status(503).json({ error: { message: 'The assistant is not configured on this deployment.' } })
  }

  // Vercel parses JSON bodies already; a string turns up when it cannot.
  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body
  if (!body || !Array.isArray(body.messages)) {
    return res.status(400).json({ error: { message: 'Missing messages' } })
  }

  const payload = {}
  for (const field of ALLOWED) {
    if (body[field] !== undefined) payload[field] = body[field]
  }

  try {
    const upstream = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const text = await upstream.text()
    // Answers are per-question and per-business; nothing here is cacheable.
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', 'application/json')
    return res.status(upstream.status).send(text)
  } catch {
    return res.status(502).json({ error: { message: 'Could not reach the model provider.' } })
  }
}

function safeParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
