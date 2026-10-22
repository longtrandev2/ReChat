---
name: ReChat Lagoon Coral
description: Design token specification for ReChat modern realtime messaging app based on Stitch Design System (Lagoon Coral theme)
colors:
  primary: "#0B7A6B"
  primary-soft: "#DDF1EC"
  primary-dark: "#005046"
  accent: "#3FC2AA"
  coral: "#C93C27"
  coral-soft: "#FFDAD4"
  coral-dark: "#FF7A63"
  surface: "#FFFFFF"
  surface-secondary: "#EEECE7"
  surface-dark: "#1A1D1C"
  surface-dark-secondary: "#242826"
  canvas: "#F6F5F2"
  canvas-dark: "#121413"
  border: "#E1DED6"
  border-dark: "#2F3432"
  ink-primary: "#181A19"
  ink-secondary: "#5B605D"
  ink-muted: "#8A928E"
  ink-primary-dark: "#ECEEEC"
  ink-secondary-dark: "#A5ABA7"
  presence-online: "#2E9E5B"
  presence-offline: "#8A928E"
typography:
  display:
    fontFamily: Be Vietnam Pro
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  headline:
    fontFamily: Be Vietnam Pro
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  otp:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.1em
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  bubble: 18px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
---

# ReChat Design Specification

## Overview
ReChat is a high-performance, calm, and distraction-free realtime collaboration and messaging application. The visual language blends the tranquility of deep mineral lagoons with warm coral accents for alerts and active engagement.

## Colors
- **Lagoon Teal (`#0B7A6B`)**: Primary brand identity, primary CTA buttons, active state indicators, and outgoing chat bubbles.
- **Lagoon Soft (`#DDF1EC`)**: Subtle backgrounds, active conversation sidebar item background, focused input glow.
- **Coral (`#C93C27`)**: Unread badges, destructive actions, high-priority notifications.
- **Warm Canvas (`#F6F5F2` / Dark: `#121413`)**: Soft tinted background avoiding harsh stark white/black glare.
- **Surface (`#FFFFFF` / Dark: `#1A1D1C`)**: Floating cards, sidebar panels, input fields.
- **Presence Online (`#2E9E5B`)**: Realtime active user indicator dot.

## Typography
- **Primary Font**: `Be Vietnam Pro` (Weights: 400 Regular, 500 Medium, 600 SemiBold, 700 Bold) - optimized for Vietnamese diacritics and clean digital reading.
- **Monospace Font**: `JetBrains Mono` - utilized exclusively for 6-digit OTP verification inputs, timestamps, and technical identifiers.

## Layout
- Dynamic Split-View for main chat (Sidebar 320-380px, Chat View flex-1, Info Drawer 300px collapsible).
- Centered Auth container (max-width 440px) with elevated card treatment on warm canvas.

## Elevation & Depth
- Layered surfaces using 1px crisp borders (`border-light` / `border-dark`) combined with subtle ambient shadow (`boxShadow.subtle`). Avoid heavy blurry drop-shadows.

## Shapes
- Buttons and inputs use `rounded-lg` (12px) for a soft, friendly, modern tactile feel.
- Message bubbles use asymmetric radii (`rounded-2xl` with specific tail clipping).
- Avatars use `rounded-full` with 2px border contrast.

## Components
- **Button**: Lagoon Teal primary with hover darkening, keyboard focus ring `ring-2 ring-brand/40 ring-offset-2`.
- **Input**: Neutral surface, 1px border, smooth transition to teal border on focus with subtle outer glow.
- **OTP Input**: Discrete 6 individual square inputs with JetBrains Mono, auto-focus sequence, and paste handling.
- **Toast Notifications**: Sonner rich toast matching surface colors with progress countdown.

## Do's and Don'ts
- **DO**: Use semantic HTML (`<form>`, `<fieldset>`, `<label>`, `<input>`, `<button>`).
- **DO**: Provide clear, accessible error messages right below invalid inputs with ARIA attributes.
- **DON'T**: Use purple gradients or AI-slop generic SaaS templates.
- **DON'T**: Trap focus or block keyboard navigation (Enter to submit, Tab between fields).
