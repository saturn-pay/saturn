import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        border: '#27272a',
        surface: '#18181b',
        background: '#09090b',
        muted: '#71717a',
        accent: '#22c55e',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(34, 197, 94, 0.15)',
        'glow-lg': '0 0 40px rgba(34, 197, 94, 0.2)',
      },
    },
  },
  plugins: [],
};

export default config;
