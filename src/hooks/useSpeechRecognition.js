import { useCallback, useEffect, useRef, useState } from 'react'

import { pickAlternative, rejectReason } from '../lib/voiceGate'

const SpeechRecognition =
  typeof window === 'undefined'
    ? null
    : window.SpeechRecognition || window.webkitSpeechRecognition

/**
 * Philippine English first, because it is the model trained on Taglish; the
 * engine may not carry it, so US English follows. The browser's own language
 * is not used — a phone set to plain English would lose the Filipino words.
 */
const PRIMARY_LANG = 'en-PH'
const FALLBACK_LANG = 'en-US'

/** Nothing said this long after the mic opens: stop, rather than let it guess. */
const SILENCE_TIMEOUT_MS = 4000

/** How long a passing message stays before the mic goes back to idle. */
const RESET_AFTER = { silent: 2500, offline: 3000, error: 3000, nomic: 3000 }

/** What each state says under the input. Idle says nothing. */
export const VOICE_MESSAGES = {
  listening: 'Listening…',
  recording: 'Recording…',
  processing: 'Processing…',
  silent: "Didn't catch that. Tap to try again.",
  blocked: 'Microphone blocked. Check your browser settings.',
  offline: 'Voice needs an internet connection.',
  nomic: 'No microphone found.',
  error: 'Voice unavailable. Try typing instead.',
}

/** The states in which the mic is open and tapping it again should stop it. */
export const ACTIVE = new Set(['listening', 'recording', 'processing'])

/**
 * One spoken phrase at a time through the browser's recogniser.
 *
 * Earlier this ran continuously with interim results, and filled every pause
 * with words nobody said. Now each tap opens the mic for a single phrase: it
 * closes at the first natural pause, only the final result counts, and that
 * result has to clear a confidence threshold and the checks in voiceGate
 * before `onTranscript` is called. A tap followed by silence ends in "Didn't
 * catch that" after four seconds instead of a hallucinated sentence.
 *
 * status: idle → listening → recording → processing → idle,
 *         or silent | blocked | offline | nomic | error.
 */
export function useSpeechRecognition({ enabled = true, onTranscript } = {}) {
  const [status, setStatusState] = useState('idle')
  const statusRef = useRef('idle')
  const recognitionRef = useRef(null)
  const startedAtRef = useRef(0)
  const silenceTimerRef = useRef(null)
  const resetTimerRef = useRef(null)
  const langRef = useRef(PRIMARY_LANG)
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const supported = Boolean(SpeechRecognition) && enabled

  // Read inside the recogniser's callbacks, which outlive any one render.
  const setStatus = useCallback(function applyStatus(next) {
    statusRef.current = next
    setStatusState(next)
    clearTimeout(resetTimerRef.current)
    const after = RESET_AFTER[next]
    if (after) resetTimerRef.current = setTimeout(() => applyStatus('idle'), after)
  }, [])

  const clearSilence = () => {
    clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = null
  }

  const teardown = useCallback(() => {
    clearSilence()
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (!recognition) return
    recognition.onstart = recognition.onspeechstart = recognition.onspeechend = null
    recognition.onresult = recognition.onerror = recognition.onend = null
    try {
      recognition.abort()
    } catch {
      // Never started.
    }
  }, [])

  useEffect(
    () => () => {
      teardown()
      clearTimeout(resetTimerRef.current)
    },
    [teardown],
  )

  // The language retry starts again from inside start's own callbacks.
  const startRef = useRef(null)

  const start = useCallback(() => {
    if (!supported) {
      setStatus('error')
      return
    }
    teardown()

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 3
    recognition.lang = langRef.current

    recognition.onstart = () => {
      startedAtRef.current = Date.now()
      setStatus('listening')
      silenceTimerRef.current = setTimeout(() => {
        // Nobody has spoken. Ending here, rather than waiting for the engine's
        // own no-speech timeout, is what stops it inventing something.
        setStatus('silent')
        teardown()
      }, SILENCE_TIMEOUT_MS)
    }

    recognition.onspeechstart = () => {
      clearSilence()
      setStatus('recording')
    }

    recognition.onspeechend = () => {
      if (statusRef.current === 'recording') setStatus('processing')
    }

    recognition.onresult = (event) => {
      clearSilence()
      const result = event.results[event.results.length - 1]
      if (!result?.isFinal) return

      const chosen = pickAlternative(result)
      const transcript = chosen?.transcript.trim() ?? ''
      const reason = chosen
        ? rejectReason(transcript, Date.now() - startedAtRef.current)
        : `low confidence (${result[0]?.confidence})`

      if (reason) {
        console.warn('[voice] discarded:', reason, transcript ? `"${transcript}"` : '')
        setStatus('silent')
        return
      }
      setStatus('idle')
      onTranscriptRef.current?.(transcript)
    }

    recognition.onerror = (event) => {
      clearSilence()
      // The engine rejects a locale it does not carry; try again in one it
      // does rather than telling someone their microphone is broken.
      if (event.error === 'language-not-supported' && langRef.current !== FALLBACK_LANG) {
        langRef.current = FALLBACK_LANG
        recognitionRef.current = null
        startRef.current()
        return
      }
      if (event.error === 'aborted') return
      if (event.error === 'no-speech') setStatus('silent')
      else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setStatus('blocked')
      else if (event.error === 'network') setStatus('offline')
      else if (event.error === 'audio-capture') setStatus('nomic')
      else {
        console.error('[voice] recognition error:', event.error)
        setStatus('error')
      }
    }

    recognition.onend = () => {
      clearSilence()
      recognitionRef.current = null
      // Still open when the engine closed: it heard something but returned
      // nothing usable, which to the person is the same as not hearing them.
      if (ACTIVE.has(statusRef.current)) setStatus('silent')
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      setStatus('error')
    }
  }, [supported, setStatus, teardown])

  useEffect(() => {
    startRef.current = start
  }, [start])

  /** Stopping by hand is a change of mind, not a failure: back to idle, quietly. */
  const stop = useCallback(() => {
    teardown()
    setStatus('idle')
  }, [teardown, setStatus])

  return {
    status,
    message: VOICE_MESSAGES[status] ?? '',
    listening: ACTIVE.has(status),
    supported,
    start,
    stop,
  }
}

export default useSpeechRecognition
