import { useState, useEffect, type ReactNode } from 'react'
import { Send, Sun, Moon } from 'lucide-react'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

/**
 * Telegram-Style Elevated Auth Layout
 * 
 * - Ambient canvas background with elevated floating card
 * - Built-in Dark/Light mode toggle with persistence
 * - Iconic circular brand badge and clean typographic hierarchy
 */
export function AuthLayout({
  children,
  title,
  subtitle,
}: AuthLayoutProps) {
  const [isDark, setIsDark] = useState(() => {
    return (
      localStorage.getItem('rechat_theme') === 'dark' ||
      (!('rechat_theme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    )
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('rechat_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('rechat_theme', 'light')
    }
  }, [isDark])

  return (
    <div className="min-h-screen w-full bg-canvas-light dark:bg-canvas-dark text-ink-primary dark:text-ink-primary-dark flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-200 relative overflow-hidden select-none">
      {/* Subtle Ambient Background Mesh */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand/5 dark:bg-brand/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-brand/5 dark:bg-brand/10 blur-3xl pointer-events-none" />

      {/* Dark / Light Mode Toggle Button (Top Right) */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <button
          type="button"
          onClick={() => setIsDark(!isDark)}
          title={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
          className="p-2.5 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-ink-secondary dark:text-ink-secondary-dark hover:text-brand dark:hover:text-brand shadow-subtle transition-all duration-150 active:scale-95"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-ink-secondary" />
          )}
        </button>
      </div>

      {/* Main Elevated Card Container */}
      <div className="w-full max-w-[420px] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl shadow-telegram p-6 sm:p-8 relative z-10 transition-colors duration-200">
        {/* Brand Circle Badge */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center text-white shadow-telegram transition-transform hover:scale-105 duration-200">
            <Send className="w-10 h-10 -ml-1 mt-0.5 text-white" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-ink-primary dark:text-ink-primary-dark mb-1.5">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-ink-secondary dark:text-ink-secondary-dark leading-relaxed max-w-[320px] mx-auto">
              {subtitle}
            </p>
          )}
        </div>

        {/* Form Body */}
        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  )
}
