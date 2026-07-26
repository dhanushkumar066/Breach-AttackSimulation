/** @type {import('tailwindcss').Config} */
export default {
  // Class strategy so the analyst can flip themes at runtime; the choice is
  // persisted to localStorage by src/lib/theme.ts.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-cyan': '#06B6D4',
        'brand-blue': '#0284C7',
        'dark-obsidian': '#05080F',
        'dark-card': 'rgba(15, 23, 42, 0.6)',
        'light-bg': '#FFFFFF',
        'light-card': '#F8FAFC',
        // Retained from the original palette so existing screens keep working.
        obsidian: '#030712',
        surface: '#0f172a',
        glow: {
          primary: '#06b6d4',
          secondary: '#f59e0b',
        },
        success: '#10b981',
        danger: '#ef4444',
      },
      fontFamily: {
        // No webfont is fetched at runtime: judging requires zero external calls,
        // so both stacks resolve against fonts already on the machine.
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Cascadia Mono',
          'ui-monospace',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        'label-caps': ['11px', { lineHeight: '16px', letterSpacing: '0.1em', fontWeight: '700' }],
        'code-sm': ['12px', { lineHeight: '16px' }],
        'code-md': ['14px', { lineHeight: '20px' }],
        'headline-md': ['20px', { lineHeight: '28px', fontWeight: '500' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '600' }],
      },
      boxShadow: {
        glass: '0 0 30px rgba(6, 182, 212, 0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
        'glow-cyan': '0 0 24px rgba(6, 182, 212, 0.35)',
        'glow-amber': '0 0 24px rgba(245, 158, 11, 0.35)',
        'glow-emerald': '0 0 24px rgba(16, 185, 129, 0.35)',
        'glow-red': '0 0 24px rgba(239, 68, 68, 0.35)',
        'card-cyan': '0 0 25px rgba(6, 182, 212, 0.15)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.1)' },
        },
        breathe: {
          '0%': { transform: 'scale(1) translate(0, 0)', opacity: '0.5' },
          '100%': { transform: 'scale(1.1) translate(2%, 2%)', opacity: '0.8' },
        },
        entrance: {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        breathe: 'breathe 15s ease-in-out infinite alternate',
        entrance: 'entrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-up': 'fade-up 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};
