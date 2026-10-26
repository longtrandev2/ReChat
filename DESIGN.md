---
name: ReChat Telegram Messenger
description: Authentic Telegram-inspired minimalist, fast, distraction-free design system for ReChat with modern micro-interactions
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
motion:
  timing-fast: 150ms
  timing-normal: 200ms
  easing: cubic-bezier(0.16, 1, 0.3, 1)
---

# ReChat Design Specification (Telegram Style & Modern Messenger)

## Overview
ReChat adheres to the world-class principles of **Telegram Web (Web K/Z)** and modern desktop messengers (Slack, Discord, Linear): calm, lightning-fast, distraction-free, hyper-legible, and enriched with delightful micro-interactions.

## Colors & Materiality
- **Telegram Blue (`#2481CC`)**: Clean, authoritative, recognizable primary brand color used on active highlights, send buttons, and focus states.
- **Telegram Soft Green (`#EFFDDE`)**: The iconic Telegram speech bubble for outgoing messages (in dark mode: `#2B5278`).
- **Presence Online (`#4FAE4E`)**: Crisp green online status dot with subtle pulse.
- **Canvas (`#F4F4F5` / Dark: `#0E1621`)**: Soft ambient gradient background (`from-[#E8EFF6] via-canvas-light to-[#E1EAF2]`) with light radial texture.
- **Surfaces (`#FFFFFF` / Dark: `#17212B`)**: Crisp panels, floating capsules, and dialogs.
- **Secondary Ink (`#707579`)**: Telegram's standard for timestamps, status subtitles, and placeholder hints.

## Typography
- System-grade font `Be Vietnam Pro` with robust fallback to native macOS (`-apple-system`) and Android (`Roboto`).
- `JetBrains Mono` reserved for 6-digit verification codes.

## Micro-Interactions & State Architecture (Modern Messenger Standard)

### 1. Conversation Sidebar Item States
- **Rest State**:
  - Borderless, clean typography, tabular timestamp on top right.
  - Avatar with 1px border and status dot.
- **Hover State (`hover:bg-black/[0.04] dark:hover:bg-white/[0.06]`)**:
  - Smooth 150ms transition.
  - Quick action trigger (3-dots context menu icon) smoothly fades in on the right (`opacity-0 group-hover:opacity-100 transition-opacity`).
  - Avatar gets subtle micro-scale (`scale-[1.03]`).
- **Active State (`bg-brand/10 dark:bg-brand-dark/20`)**:
  - Vertical accent indicator pill on the left edge (`before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-brand before:rounded-r-full`).
  - Active conversation text is crisp with primary font weight.

### 2. Message Bubble Interactivity
- **Hover Reaction & Action Bar**:
  - Hovering over a message bubble reveals a subtle micro action button (Quick Reply / Reaction) without altering text flow.
  - Smooth shadow elevation (`hover:shadow-md transition-shadow`).
- **Inline Metadata Wrapping**:
  - Short messages keep text and timestamp + read checkmarks on the same row (`flex-wrap: wrap; items-end; gap-x-2.5`).
  - Double checkmark turns vivid `#4FAE4E` / `#5288C1` when read.

### 3. Navigation Rail (Global Left Bar)
- **Active Pill Indicator**:
  - Vertical pill indicator on the far left edge of the rail to communicate the active module cleanly (Discord/Slack standard).
  - Hover tooltip with item name and subtle icon scale (`group-hover:scale-110`).
- **Theme Toggle Micro-Animation**:
  - Sun/Moon icon rotates and scales gracefully on hover and toggle.

### 4. Floating Capsule Composer
- **Input Container**:
  - Floating pill (`rounded-3xl`) with gentle elevation and focus border glow (`focus-within:ring-2 focus-within:ring-brand/25`).
  - Paperclip and emoji buttons provide tactile feedback (`hover:scale-110 active:scale-95`).
- **Send Trigger**:
  - Circular brand blue button with spring active push (`active:scale-95 transition-transform`).

### 5. Floating Quick-Scroll Button
- Floating circular button (`ChevronDown`) with smooth entrance animation (`animate-in fade-in zoom-in-75 duration-150`) appears when user scrolls up from feed bottom.
