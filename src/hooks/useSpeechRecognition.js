import { useCallback, useEffect, useRef, useState } from 'react'

const SpeechRecognition =
  typeof window === 'undefined'
    ? null
    : window.SpeechRecognition || window.webkitSpeechRecognition

/** Philippine English first; the engine may not carry it, so US English follows. */
const PRIMARY_LANG = 'en-PH'
const FALLBACK_LANG = 'en-US'

function messageFor(error) {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'Microphone permission denied. Allow it in your browser settings.'
  }
  if (error === 'no-speech') return 'No speech detected. Try again.'
  if (error === 'audio-capture') return 'No microphone found.'
  return 'Voice input unavailable. Try again.'
}

/**
 * Dictation through the browser's own recogniser.
 *
 * The caller is handed the whole transcript on every result rather than the
 * fragments the API emits: the API commits a phrase at a time and reports each
 * new one in isolation, so a consumer that appended what it was given would
 * have to reconstruct the sentence itself, and would double up whenever a
 * pending phrase was revised.
 *
 * Callbacks are held in a ref because the recogniser is built once — rebuilding
 * it on a re-render would drop an in-flight session on the floor.
 */
export function useSpeechRecognition({ enabled = true, onResult, onEnd, onError } = {}) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  // Everything the recogniser has committed this session.
  const finalRef = useRef('')
  const handlers = useRef({})
  handlers.current = { onResult, onEnd, onError }

  const supported = Boolean(SpeechRecognition) && enabled

  useEffect(() => {
    if (!supported) return undefined

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = PRIMARY_LANG

    recognition.onresult = (event) => {
      let interim = ''
      let fresh = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const [{ transcript }] = event.results[i]
        if (event.results[i].isFinal) fresh += transcript
        else interim += transcript
      }
      if (fresh) finalRef.current = `${finalRef.current}${fresh}`
      handlers.current.onResult?.({
        interim,
        final: fresh,
        transcript: `${finalRef.current}${interim}`,
      })
    }

    recognition.onend = () => {
      setListening(false)
      handlers.current.onEnd?.(finalRef.current)
    }

    recognition.onerror = (event) => {
      // The engine rejects a locale it does not carry; retry in one it does
      // rather than telling someone their microphone is broken.
      if (event.error === 'language-not-supported' && recognition.lang !== FALLBACK_LANG) {
        recognition.lang = FALLBACK_LANG
        try {
          recognition.start()
          return
        } catch {
          // Falls through to the message below.
        }
      }
      setListening(false)
      handlers.current.onError?.(messageFor(event.error))
    }

    recognitionRef.current = recognition
    return () => {
      recognition.onresult = null
      recognition.onend = null
      recognition.onerror = null
      try {
        recognition.abort()
      } catch {
        // Never started.
      }
      recognitionRef.current = null
    }
  }, [supported])

  const start = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition || listening) return
    finalRef.current = ''
    try {
      recognition.start()
      setListening(true)
    } catch {
      // Already running.
    }
  }, [listening])

  const stop = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    setListening(false)
    try {
      recognition.stop()
    } catch {
      // Never started.
    }
  }, [])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  return { listening, supported, start, stop, toggle }
}

export default useSpeechRecognition
