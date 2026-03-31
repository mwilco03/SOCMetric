/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'kpi-green': '#10b981',
        'kpi-yellow': '#f59e0b',
        'kpi-red': '#ef4444',
        'kpi-blue': '#3b82f6',
        'kpi-gray': '#6b7280',
        'soc-bg': '#0f172a',
        'soc-card': '#1e293b',
        'soc-border': '#334155',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

