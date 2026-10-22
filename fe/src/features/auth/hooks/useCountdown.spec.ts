import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCountdown } from './useCountdown'

describe('useCountdown Hook (ZOMBIES & AAA Methodology)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  // Z - Zero
  it('Z: handles 0 initial seconds properly without running', () => {
    // Arrange & Act
    const { result } = renderHook(() => useCountdown(0, { autoStart: false }))

    // Assert
    expect(result.current.secondsLeft).toBe(0)
    expect(result.current.isFinished).toBe(true)
    expect(result.current.formattedTime).toBe('00:00')
  })

  // O - One
  it('O: counts down 1 second and triggers onComplete exactly once', () => {
    // Arrange
    const onCompleteMock = vi.fn()
    const { result } = renderHook(() =>
      useCountdown(1, { autoStart: true, onComplete: onCompleteMock })
    )

    // Act (Advance 1 second)
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Assert
    expect(result.current.secondsLeft).toBe(0)
    expect(result.current.isFinished).toBe(true)
    expect(onCompleteMock).toHaveBeenCalledTimes(1)
  })

  // M - Many
  it('M: counts down accurately across multiple seconds and updates formattedTime', () => {
    // Arrange
    const { result } = renderHook(() => useCountdown(60, { autoStart: true }))
    expect(result.current.formattedTime).toBe('01:00')

    // Act: Advance 15 seconds
    act(() => {
      vi.advanceTimersByTime(15000)
    })

    // Assert
    expect(result.current.secondsLeft).toBe(45)
    expect(result.current.formattedTime).toBe('00:45')
    expect(result.current.isFinished).toBe(false)
  })

  // B - Boundaries
  it('B: boundary check - stops at 0 and does not decrement into negative numbers', () => {
    // Arrange
    const onCompleteMock = vi.fn()
    const { result } = renderHook(() =>
      useCountdown(3, { autoStart: true, onComplete: onCompleteMock })
    )

    // Act: Advance 10 seconds (well past the 3 seconds limit)
    act(() => {
      vi.advanceTimersByTime(10000)
    })

    // Assert
    expect(result.current.secondsLeft).toBe(0)
    expect(result.current.isFinished).toBe(true)
    expect(result.current.formattedTime).toBe('00:00')
    // Crucial: onComplete must not be invoked repeatedly past 0
    expect(onCompleteMock).toHaveBeenCalledTimes(1)
  })

  // I - Interface & Formatting
  it('I: formats mm:ss correctly with leading zeros (e.g. 5s -> 00:05, 75s -> 01:15)', () => {
    // Arrange & Act
    const { result: r5 } = renderHook(() => useCountdown(5, { autoStart: false }))
    const { result: r75 } = renderHook(() => useCountdown(75, { autoStart: false }))

    // Assert
    expect(r5.current.formattedTime).toBe('00:05')
    expect(r75.current.formattedTime).toBe('01:15')
  })

  // E - Edge Cases: autoStart=false and manual start
  it('E: does not start counting down when autoStart is false until start() is invoked', () => {
    // Arrange
    const { result } = renderHook(() => useCountdown(30, { autoStart: false }))

    // Act: Advance 5 seconds without starting
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    // Assert: Time remains unchanged
    expect(result.current.secondsLeft).toBe(30)
    expect(result.current.isFinished).toBe(false)

    // Act: Manually start
    act(() => {
      result.current.start()
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // Assert: Now counts down
    expect(result.current.secondsLeft).toBe(28)
  })

  // E - Edge Cases: reset() clears timer and restores initial seconds
  it('E: reset() stops active countdown and resets to initial duration', () => {
    // Arrange
    const { result } = renderHook(() => useCountdown(60, { autoStart: true }))

    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(result.current.secondsLeft).toBe(50)

    // Act: Reset
    act(() => {
      result.current.reset()
    })

    // Assert: Back to 60 and paused
    expect(result.current.secondsLeft).toBe(60)

    // Act: Advance time to verify interval was cleared
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current.secondsLeft).toBe(60)
  })

  // E - Edge Cases: Stale closure prevention
  it('E: captures updated onComplete callback without restarting timer', () => {
    // Arrange
    const firstCallback = vi.fn()
    const secondCallback = vi.fn()

    const { rerender } = renderHook(
      ({ cb }) => useCountdown(2, { autoStart: true, onComplete: cb }),
      { initialProps: { cb: firstCallback } }
    )

    // Act: Advance 1s, then update onComplete callback mid-flight
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    rerender({ cb: secondCallback })

    // Act: Complete countdown
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Assert: Only the latest callback must be called
    expect(firstCallback).not.toHaveBeenCalled()
    expect(secondCallback).toHaveBeenCalledTimes(1)
  })

  // E - Edge Cases: Cleanup on unmount (prevent memory leaks)
  it('E: clears interval immediately when component unmounts', () => {
    // Arrange
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = renderHook(() => useCountdown(60, { autoStart: true }))

    // Act
    unmount()

    // Assert
    expect(clearIntervalSpy).toHaveBeenCalled()
  })
})
