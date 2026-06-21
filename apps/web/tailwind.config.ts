import type { Config } from 'tailwindcss';

/**
 * Valloreg brand theme.
 * Colors are exposed both as Tailwind tokens and as CSS variables (see globals.css)
 * so they can be reused in raw CSS / inline styles when needed.
 *
 * Contrast notes (WCAG AA):
 *  - anthracite (#1F2937) text on light (#F8FAFC) / white → AAA.
 *  - white text on primary-600 (#EA580C) and darker → AA for normal text.
 *  - Avoid white text on primary-400/500 for small text (use primary-600+).
 */
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary – orange brand
        primary: {
          DEFAULT: '#F97316',
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        // Secondary – cappuccino
        secondary: {
          DEFAULT: '#C19A6B',
          50: '#FBF7F2',
          100: '#F3E9DB',
          200: '#E7D2B7',
          300: '#DABB93',
          400: '#CEAA7F',
          500: '#C19A6B',
          600: '#A87E4E',
          700: '#82613C',
          800: '#5C442A',
          900: '#372818',
        },
        // Anthracite – dark contrast
        anthracite: {
          DEFAULT: '#1F2937',
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        // Surfaces
        light: '#F8FAFC',
        surface: '#FFFFFF',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(31 41 55 / 0.08), 0 1px 2px -1px rgb(31 41 55 / 0.06)',
        'card-hover': '0 10px 25px -5px rgb(31 41 55 / 0.12), 0 8px 10px -6px rgb(31 41 55 / 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
