/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Stitch Design Tokens: Lagoon Coral Theme
        brand: {
          DEFAULT: '#0B7A6B', // Lagoon Teal
          soft: '#DDF1EC',
          dark: '#005046',
          accent: '#3FC2AA',
        },
        coral: {
          DEFAULT: '#C93C27', // Unread badge & danger/alert
          soft: '#FFDAD4',
          dark: '#FF7A63',
        },
        presence: {
          online: '#2E9E5B',
          offline: '#8A928E',
        },
        canvas: {
          light: '#F6F5F2',
          dark: '#121413',
        },
        surface: {
          light: '#FFFFFF',
          'light-2': '#EEECE7',
          dark: '#1A1D1C',
          'dark-2': '#242826',
        },
        border: {
          light: '#E1DED6',
          dark: '#2F3432',
        },
        ink: {
          primary: '#181A19',
          secondary: '#5B605D',
          muted: '#8A928E',
          'primary-dark': '#ECEEEC',
          'secondary-dark': '#A5ABA7',
        },
        bubble: {
          out: '#0B7A6B',
          'out-dark': '#1C6B5E',
          in: '#EEECE7',
          'in-dark': '#242826',
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        bubble: '1.125rem', // 18px standard message bubble
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(18, 20, 19, 0.04)',
        modal: '0 4px 16px -2px rgba(18, 20, 19, 0.08), 0 0 0 1px var(--border-color, #E1DED6)',
        'modal-dark': '0 4px 20px -2px rgba(0, 0, 0, 0.4), 0 0 0 1px #2F3432',
      },
    },
  },
  plugins: [],
}
