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
      <span className="px-3.5 py-0.5 rounded-full text-[12px] font-medium bg-black/25 dark:bg-black/45 text-white backdrop-blur-md shadow-xs border border-white/10 tracking-wide">
        {formatted}
      </span>
    </div>
  )
}
