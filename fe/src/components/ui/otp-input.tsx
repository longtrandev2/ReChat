import React, { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface OtpInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (code: string) => void
  disabled?: boolean
  error?: boolean
  autoFocus?: boolean
  className?: string
}

/**
 * Reusable Accessible 6-Digit OTP Input Primitive (Telegram Style)
 * 
 * - Discrete individual digit inputs with JetBrains Mono typography
 * - Smooth auto-focus forward navigation upon typing
 * - Smart Backspace handling (clears and shifts focus backward)
 * - Clipboard Paste handling (extracts first 6 digits, populates all boxes, triggers onComplete)
 * - Full Mobile keypad support (inputMode="numeric", pattern="[0-9]*")
 */
export function OtpInput({
  length = 6,
  value = '',
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = true,
  className,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Normalize current digits array from value prop
  const digits = Array.from({ length }, (_, i) => value[i] || '')

  useEffect(() => {
    if (autoFocus && inputRefs.current[0] && !disabled) {
      inputRefs.current[0].focus()
    }
  }, [autoFocus, disabled])

  const handleInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value
    // Extract only digits
    const cleaned = rawVal.replace(/\D/g, '')

    if (!cleaned && rawVal !== '') {
      return
    }

    const newDigit = cleaned.slice(-1) // Take the last character typed
    const newDigits = [...digits]
    newDigits[index] = newDigit

    const newValue = newDigits.join('')
    onChange(newValue)

    // Auto-advance to next input
    if (newDigit && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    // Trigger onComplete when all digits are filled
    if (newValue.length === length && !newDigits.includes('')) {
      onComplete?.(newValue)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // If current box is empty, move back and clear previous box
        e.preventDefault()
        const newDigits = [...digits]
        newDigits[index - 1] = ''
        onChange(newDigits.join(''))
        inputRefs.current[index - 1]?.focus()
      } else if (digits[index]) {
        // If current box has a value, clear it without moving back
        e.preventDefault()
        const newDigits = [...digits]
        newDigits[index] = ''
        onChange(newDigits.join(''))
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault()
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (disabled) return

    const pastedData =
      e.clipboardData.getData('text/plain') || e.clipboardData.getData('text') || ''
    const numericOnly = pastedData.replace(/\D/g, '').slice(0, length)

    if (numericOnly.length > 0) {
      onChange(numericOnly)

      // Focus on the next empty box or the last box
      const targetFocusIndex = Math.min(numericOnly.length, length - 1)
      inputRefs.current[targetFocusIndex]?.focus()

      if (numericOnly.length === length) {
        onComplete?.(numericOnly)
      }
    }
  }

  return (
    <div
      role="group"
      aria-label={`Mã xác thực ${length} chữ số`}
      className={cn('flex items-center justify-center gap-2 sm:gap-3', className)}
    >
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[index]}
          disabled={disabled}
          onChange={(e) => handleInputChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          aria-label={`Chữ số thứ ${index + 1}`}
          aria-invalid={error}
          className={cn(
            'w-11 h-14 sm:w-13 sm:h-16 text-center font-mono text-2xl font-bold rounded-xl border border-border-light bg-surface-light text-ink-primary shadow-subtle transition-all duration-150 placeholder:text-transparent focus-visible:outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark dark:text-ink-primary-dark dark:focus-visible:border-brand dark:focus-visible:ring-brand/25',
            error && 'border-coral text-coral focus-visible:border-coral focus-visible:ring-coral/15',
            digits[index] && 'border-brand/60 bg-brand-soft/20 dark:border-brand/80 dark:bg-brand-soft/5'
          )}
        />
      ))}
    </div>
  )
}
