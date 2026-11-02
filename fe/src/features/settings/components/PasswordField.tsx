import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input, type InputProps } from '@/components/ui/input'

interface PasswordFieldProps extends Omit<InputProps, 'type' | 'error'> {
  id: string
  label: string
  errorMessage?: string
}

/**
 * PasswordField: ô mật khẩu có nút ẩn/hiện (Eye / EyeOff), nhãn và thông báo lỗi.
 * Tương thích react-hook-form register() qua forwardRef.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ id, label, errorMessage, className, ...props }, ref) => {
    const [isVisible, setIsVisible] = useState(false)

    return (
      <div className="space-y-1">
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-ink-secondary dark:text-ink-secondary-dark uppercase tracking-wider"
        >
          {label}
        </label>
        <div className="relative">
          <Input
            id={id}
            ref={ref}
            type={isVisible ? 'text' : 'password'}
            error={Boolean(errorMessage)}
            aria-invalid={Boolean(errorMessage)}
            className={`pr-11 ${className ?? ''}`}
            {...props}
          />
          <button
            type="button"
            onClick={() => setIsVisible((v) => !v)}
            tabIndex={-1}
            aria-label={isVisible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary dark:hover:text-ink-primary-dark transition-colors"
          >
            {isVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {errorMessage && (
          <p className="text-xs text-coral mt-1" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    )
  }
)
PasswordField.displayName = 'PasswordField'
