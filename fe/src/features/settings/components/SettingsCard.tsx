import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SettingsCardProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  testId?: string
}

/**
 * SettingsCard: khung thẻ (Card Surface) dùng chung cho các khối trong Settings Hub, chuẩn DESIGN.md
 */
export function SettingsCard({ title, description, icon, action, children, className, testId }: SettingsCardProps) {
  return (
    <section
      className={cn(
        'bg-surface dark:bg-[#17212B] border border-border/80 dark:border-border-dark rounded-2xl p-5 sm:p-6 shadow-2xs',
        className
      )}
      data-testid={testId}
    >
      <header className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="w-9 h-9 rounded-xl bg-brand-soft dark:bg-brand/15 text-brand dark:text-brand-accent flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-primary dark:text-ink-primary-dark">{title}</h2>
            {description && (
              <p className="text-xs sm:text-sm text-ink-secondary dark:text-ink-secondary-dark mt-0.5 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </section>
  )
}
