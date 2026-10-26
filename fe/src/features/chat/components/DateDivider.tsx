import { formatDateDivider } from '../utils/format-message'

interface DateDividerProps {
  date: string | Date
}

/**
 * DateDivider: Nhãn ngày nổi mềm mại ở giữa luồng tin nhắn (Telegram Sticky/Floating Pill)
 */
export function DateDivider({ date }: DateDividerProps) {
  const formatted = formatDateDivider(date)
  if (!formatted) return null

  return (
    <div className="flex justify-center my-3 select-none pointer-events-none sticky top-2 z-10">
      <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-[#000000]/15 dark:bg-[#000000]/40 text-ink-primary dark:text-ink-primary-dark backdrop-blur-md shadow-xs">
        {formatted}
      </span>
    </div>
  )
}
