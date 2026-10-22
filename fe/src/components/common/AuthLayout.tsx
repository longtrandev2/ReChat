import type { ReactNode } from 'react'
import { Send } from 'lucide-react'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

/**
 * Authentic Telegram-Inspired Auth Layout
 * 
 * - Iconic circular Telegram Blue icon header with paper plane
 * - Focused, distraction-free vertical flow
 * - Zero fake cards, zero ornaments, hyper-legible typography
 */
export function AuthLayout({
  children,
  title,
  subtitle,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-white dark:bg-canvas-dark text-ink-primary dark:text-ink-primary-dark flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-200">
      <div className="w-full max-w-[380px] flex flex-col items-center">
        {/* Telegram-style Circular Brand Icon */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-brand flex items-center justify-center text-white shadow-telegram mb-6 select-none transition-transform hover:scale-105 duration-200">
          <Send className="w-10 h-10 sm:w-12 sm:h-12 -ml-1 mt-0.5 text-white" />
        </div>

        {/* Title & Helpful Telegram Subtext */}
        <h1 className="text-2xl sm:text-[26px] font-bold text-center text-ink-primary dark:text-ink-primary-dark tracking-tight mb-2">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-ink-secondary dark:text-ink-secondary-dark text-center leading-relaxed mb-8 max-w-[320px]">
            {subtitle}
          </p>
        )}

        {/* Form Container */}
        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  )
}
