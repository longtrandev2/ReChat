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
        // Telegram Messenger Palette
        brand: {
          DEFAULT: '#2481CC', // Telegram Classic Blue
          hover: '#1E74B8',
          soft: '#E7F3FA',
          dark: '#1665A3',
          accent: '#5288C1',
        },
        presence: {
          online: '#4FAE4E', // Telegram Online Green
          offline: '#A2ACB0',
        },
        coral: {
          DEFAULT: '#E53935', // Destructive / Alert
          soft: '#FDE8E8',
          dark: '#C62828',
        },
        canvas: {
          light: '#F4F4F5',
          dark: '#0E1621', // Telegram Dark canvas
        },
        surface: {
          light: '#FFFFFF',
          'light-2': '#F4F4F5',
          dark: '#17212B', // Telegram Dark surface
          'dark-2': '#242F3D',
        },
        border: {
          light: '#E4E4E7',
          dark: '#232E3C',
        },
        ink: {
          primary: '#1C1C1E',
          secondary: '#707579', // Telegram Secondary Ink
          muted: '#A2ACB0',
          'primary-dark': '#F5F5F7',
          'secondary-dark': '#8E959B',
        },
        bubble: {
          out: '#EFFDDE', // Telegram Light Outgoing bubble
          'out-dark': '#2B5278', // Telegram Dark Outgoing bubble
          in: '#FFFFFF',
          'in-dark': '#182533',
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.5rem',
        md: '0.625rem',
        lg: '0.75rem',
        xl: '1rem',
        bubble: '1rem',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        telegram: '0 2px 8px -1px rgba(0, 0, 0, 0.08), 0 1px 3px -1px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
}
