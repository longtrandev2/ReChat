import { useState, useEffect, useRef, useCallback } from 'react'

interface UseCountdownOptions {
  autoStart?: boolean
  onComplete?: () => void
}

/**
 * Custom Hook: useCountdown
 * 
 * - Manages countdown timer (e.g. 60s for OTP Resend cooldown)
 * - Employs useState for visible seconds countdown (triggers UI re-render)
 * - Employs useRef for timerId (stores interval reference silently without re-render)
 * - Employs useRef for onComplete callback (prevents stale closure & interval restarts)
 * - Guarantees clearInterval cleanup on unmount to prevent memory leaks
 * - React 19 lint compliant (avoids synchronous setState inside useEffect body)
 */
export function useCountdown(
  initialSeconds = 60,
  options: UseCountdownOptions = {}
) {
  const { autoStart = true, onComplete } = options
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onCompleteRef = useRef(onComplete)

  // Keep latest onComplete callback in ref to prevent stale closures
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const start = useCallback(
    (seconds = initialSeconds) => {
      clearTimer()
      setSecondsLeft(seconds)

      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearTimer()
            onCompleteRef.current?.()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    },
    [initialSeconds, clearTimer]
  )

  const reset = useCallback(() => {
    clearTimer()
    setSecondsLeft(initialSeconds)
  }, [initialSeconds, clearTimer])

  // Setup initial interval on mount if autoStart is true
  useEffect(() => {
    if (!autoStart) return

    clearTimer()
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTimer()
          onCompleteRef.current?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      clearTimer()
    }
  }, [autoStart, clearTimer])

  // Format as mm:ss (e.g. 00:54, 01:00)
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return {
    secondsLeft,
    isFinished: secondsLeft === 0,
    formattedTime,
    start,
    reset,
    clearTimer,
  }
}
