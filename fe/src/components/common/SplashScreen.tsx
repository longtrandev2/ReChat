import React from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, ShieldCheck, Lock } from 'lucide-react'

export interface SplashScreenProps {
  message?: string
}

/**
 * Màn hình Splash Screen / App Initialization Gate cao cấp:
 * Chuẩn Telegram Web & Linear Design:
 * - Hiệu ứng ambient background glow đa tầng (Light/Dark mode)
 * - Logo bay lơ lửng (levitation micro-interaction) kết hợp sóng xung kích (pulse aura rings)
 * - Thanh tải xung nhịp laser luminous gradient mượt mà
 * - Huy hiệu bảo mật chuẩn End-to-End & Dual-Token HttpOnly
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({
  message = 'Đang đồng bộ và khôi phục phiên làm việc an toàn...',
}) => {
  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-canvas-light dark:bg-canvas-dark select-none transition-colors duration-300">
      {/* 1. Ambient Background Glow Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="pointer-events-none absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-brand/20 blur-[100px] dark:bg-brand/25"
      />
      <motion.div
        animate={{
          scale: [1.1, 0.95, 1.1],
          opacity: [0.12, 0.22, 0.12],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
        className="pointer-events-none absolute -bottom-32 -right-32 h-[450px] w-[450px] rounded-full bg-brand-accent/20 blur-[110px] dark:bg-brand-accent/25"
      />

      {/* Subtle Micro-dot Background Texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* 2. Central Glassmorphic Brand Hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center px-6 py-8"
      >
        {/* Animated Brand Logo Icon with Levitation & Double Pulse Waves */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 3.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="relative mb-7 flex items-center justify-center"
        >
          {/* Outer Pulse Wave 1 */}
          <motion.div
            animate={{
              scale: [1, 1.45, 1.7],
              opacity: [0.45, 0.18, 0],
            }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: 'easeOut',
            }}
            className="absolute h-20 w-20 rounded-3xl bg-brand/30 blur-sm"
          />

          {/* Outer Pulse Wave 2 (Staggered) */}
          <motion.div
            animate={{
              scale: [1, 1.3, 1.55],
              opacity: [0.35, 0.12, 0],
            }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: 'easeOut',
              delay: 0.8,
            }}
            className="absolute h-20 w-20 rounded-3xl bg-brand-accent/30 blur-sm"
          />

          {/* Core Icon Box with Gradient & Telegram Shadow */}
          <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-gradient-to-tr from-brand via-[#278cdb] to-brand-accent shadow-[0_12px_28px_-6px_rgba(36,129,204,0.45)] ring-1 ring-white/25">
            {/* Shimmer Gloss Overlay */}
            <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-gradient-to-b from-white/20 to-transparent" />
            <MessageSquare className="h-9 w-9 text-white stroke-[2.2] drop-shadow-sm" />
          </div>
        </motion.div>

        {/* Brand Title with Gradient Typography */}
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-ink-primary dark:text-ink-primary-dark">
          Re<span className="bg-gradient-to-r from-brand via-[#3ba2f5] to-brand-accent bg-clip-text text-transparent">Chat</span>
        </h1>

        {/* Mini Subtitle Pill */}
        <div className="mb-5 flex items-center gap-1.5 rounded-full bg-brand/10 dark:bg-brand/20 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-brand dark:text-brand-accent uppercase">
          <Lock className="h-2.5 w-2.5" />
          <span>Next-Gen Messenger</span>
        </div>

        {/* Dynamic Status Message with Animated Bouncing Dots */}
        <div className="mb-5 flex items-center justify-center gap-1.5">
          <p className="max-w-xs text-center text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">
            {message}
          </p>
          <span className="inline-flex items-center gap-0.5 text-brand">
            <motion.span
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
              className="h-1 w-1 rounded-full bg-current"
            />
            <motion.span
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
              className="h-1 w-1 rounded-full bg-current"
            />
            <motion.span
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
              className="h-1 w-1 rounded-full bg-current"
            />
          </span>
        </div>

        {/* Modern Indeterminate Luminous Laser Progress Bar */}
        <div className="relative h-1.5 w-56 overflow-hidden rounded-full bg-border-light/80 dark:bg-surface-dark-2 shadow-inner">
          <motion.div
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="absolute top-0 bottom-0 w-2/3 rounded-full bg-gradient-to-r from-transparent via-brand to-transparent shadow-[0_0_12px_rgba(36,129,204,0.7)]"
          />
        </div>
      </motion.div>

      {/* 3. Glassmorphic Security Trust Badge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.6 }}
        className="absolute bottom-8 flex items-center gap-2 rounded-full border border-border/60 dark:border-border-dark/60 bg-surface/60 dark:bg-surface-dark/60 px-3.5 py-1.5 shadow-sm backdrop-blur-md text-[11px] font-medium text-ink-muted dark:text-ink-secondary-dark tracking-wide"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-presence-online opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-presence-online" />
        </span>
        <ShieldCheck className="h-3.5 w-3.5 text-presence-online" />
        <span>End-to-End Encrypted · Dual-Token Protected</span>
      </motion.div>
    </div>
  )
}
