---
name: ReChat Telegram Messenger
description: Authentic Telegram-inspired minimalist, fast, distraction-free design system for ReChat
colors:
  primary: "#2481CC"
  primary-hover: "#1E74B8"
  primary-soft: "#E7F3FA"
  bubble-out-light: "#EFFDDE"
  bubble-out-dark: "#2B5278"
  bubble-in-light: "#FFFFFF"
  bubble-in-dark: "#182533"
  surface: "#FFFFFF"
  surface-hover: "#F4F4F5"
  surface-dark: "#17212B"
  surface-dark-secondary: "#242F3D"
  canvas: "#F4F4F5"
  canvas-dark: "#0E1621"
  border: "#E4E4E7"
  border-dark: "#232E3C"
  ink-primary: "#1C1C1E"
  ink-secondary: "#707579"
  ink-muted: "#A2ACB0"
  ink-primary-dark: "#F5F5F7"
  ink-secondary-dark: "#8E959B"
  presence-online: "#4FAE4E"
  presence-offline: "#A2ACB0"
  coral: "#E53935"
  coral-soft: "#FDE8E8"
typography:
  headline:
    fontFamily: Be Vietnam Pro, system-ui, -apple-system, sans-serif
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: Be Vietnam Pro, system-ui, -apple-system, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  subtext:
    fontFamily: Be Vietnam Pro, system-ui, -apple-system, sans-serif
    fontSize: 13px
    fontWeight: 400
    color: "#707579"
  otp:
    fontFamily: JetBrains Mono, monospace
    fontSize: 24px
    fontWeight: 600
rounded:
  sm: 6px
  md: 10px
  lg: 12px
  xl: 16px
  full: 9999px
---

# ReChat Design Specification (Telegram Style)

## Overview
ReChat adheres to the world-class principles of **Telegram Web**: calm, lightning-fast, distraction-free, and hyper-legible. We strictly reject AI-slop ornaments, fake telemetry, and non-functional badges in favor of purposeful utility and crisp aesthetics.

## Colors
- **Telegram Blue (`#2481CC`)**: Clean, authoritative, recognizable primary brand color used on primary CTAs, active highlights, and verification prompts.
- **Telegram Soft Green (`#EFFDDE`)**: The iconic Telegram speech bubble for outgoing messages (in dark mode: `#2B5278`).
- **Presence Online (`#4FAE4E`)**: Crisp green online status dot.
- **Canvas (`#F4F4F5` / Dark: `#0E1621`)**: Clean background ensuring extreme legibility.
- **Surfaces (`#FFFFFF` / Dark: `#17212B`)**: Crisp panels, message lists, and dialogs.
- **Secondary Ink (`#707579`)**: Telegram's standard for timestamps, status subtitles, and placeholder hints.

## Typography
- System-grade font `Be Vietnam Pro` with robust fallback to native macOS (`-apple-system`) and Android (`Roboto`).
- `JetBrains Mono` reserved for 6-digit verification codes.

## Layout & Auth Flow (Telegram Web Standard)
- Centered circular Telegram-inspired brand badge with gentle floating elevation.
- Prominent heading: "ReChat" or "Đăng nhập ReChat".
- Helpful guidance subtext: "Vui lòng nhập tài khoản hoặc email để bắt đầu nhắn tin".
- High-contrast, clean input fields with soft focus rings.
- Large full-width primary button (`bg-[#2481CC] text-white py-3 rounded-xl uppercase font-semibold text-sm tracking-wider`).
- Fast navigation between Login, Register, and OTP verification.
