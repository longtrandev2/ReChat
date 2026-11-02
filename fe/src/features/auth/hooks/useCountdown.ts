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
  const remainingRef = useRef(initialSeconds)

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

  const scheduleInterval = useCallback(() => {
    clearTimer()
    timerRef.current = setInterval(() => {
      remainingRef.current -= 1
      setSecondsLeft(remainingRef.current)

      if (remainingRef.current <= 0) {
        clearTimer()
        onCompleteRef.current?.()
      }
    }, 1000)
  }, [clearTimer])

  const start = useCallback(
    (seconds = initialSeconds) => {
      clearTimer()
      remainingRef.current = seconds
      setSecondsLeft(seconds)

      if (seconds <= 0) {
        onCompleteRef.current?.()
        return
      }

      scheduleInterval()
    },
    [initialSeconds, clearTimer, scheduleInterval]
  )

  const reset = useCallback(() => {
    clearTimer()
    remainingRef.current = initialSeconds
    setSecondsLeft(initialSeconds)
  }, [initialSeconds, clearTimer])

  // Setup initial interval on mount if autoStart is true
  useEffect(() => {
    if (autoStart && initialSeconds > 0) {
      remainingRef.current = initialSeconds
      scheduleInterval()
    }
    return () => {
      clearTimer()
    }
  }, [autoStart, initialSeconds, scheduleInterval, clearTimer])

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
