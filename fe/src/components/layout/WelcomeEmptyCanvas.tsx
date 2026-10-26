import { Send } from 'lucide-react'

/**
 * WelcomeEmptyCanvas (Telegram-style Default Chat View)
 * Displays a clean, tranquil placeholder when no conversation is actively selected.
 */
export function WelcomeEmptyCanvas() {
  return (
    <div
      role="region"
      aria-label="Khu vực trò chuyện trống"
      className="flex-1 h-full w-full flex flex-col items-center justify-center p-6 bg-canvas-light dark:bg-canvas-dark select-none animate-in fade-in duration-200"
    >
      <div className="flex flex-col items-center max-w-sm text-center">
        {/* Telegram-style Circular Icon Container */}
        <div className="w-18 h-18 rounded-full bg-brand/10 dark:bg-brand-dark/20 text-brand dark:text-brand-accent flex items-center justify-center mb-5 shadow-subtle">
          <Send
            className="w-8 h-8 translate-x-0.5 -translate-y-0.5 -rotate-12"
            aria-hidden="true"
          />
        </div>

        {/* Heading & Subtitle */}
        <h2 className="text-lg font-semibold text-ink-primary dark:text-ink-primary-dark">
          Chọn một cuộc trò chuyện
        </h2>
        <p className="text-sm text-ink-secondary dark:text-ink-secondary-dark mt-1.5 leading-relaxed">
          Chọn một người bạn hoặc nhóm chat từ danh sách để bắt đầu gửi tin nhắn bảo mật theo thời gian thực.
        </p>

        {/* Realtime Gateway Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 mt-5 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-xs text-ink-secondary dark:text-ink-secondary-dark shadow-xs">
          <span
            className="w-2 h-2 rounded-full bg-presence-online animate-pulse"
            aria-hidden="true"
          />
          <span>Cổng kết nối thời gian thực đã sẵn sàng</span>
        </div>
      </div>
    </div>
  )
}
