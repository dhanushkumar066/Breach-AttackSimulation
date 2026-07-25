/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#030712',
        surface: '#0f172a',
        glow: {
          primary: '#06b6d4',
          secondary: '#f59e0b',
        },
        success: '#10b981',
        danger: '#ef4444',
        'text-primary': '#f8fafc',
        'text-muted': '#64748b',
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
      boxShadow: {
        glass: '0 0 30px rgba(6, 182, 212, 0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
        'glow-cyan': '0 0 24px rgba(6, 182, 212, 0.35)',
        'glow-amber': '0 0 24px rgba(245, 158, 11, 0.35)',
        'glow-emerald': '0 0 24px rgba(16, 185, 129, 0.35)',
        'glow-red': '0 0 24px rgba(239, 68, 68, 0.35)',
      },
      backdropBlur: {
        xl: '20px',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.08)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        'scan-line': 'scan-line 6s linear infinite',
        'fade-up': 'fade-up 0.35s ease-out both',
        shimmer: 'shimmer 2.2s linear infinite',
      },
    },
  },
  plugins: [],
};
