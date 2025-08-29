// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-bg-primary)',
        'background-secondary': 'var(--color-bg-secondary)',
        panel: 'var(--color-bg-panel)',
        'panel-hover': 'var(--color-bg-panel-hover)',
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        'panel-text': 'var(--color-text-panel)',
        'panel-text-secondary': 'var(--color-text-panel-secondary)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        'on-accent': 'var(--color-text-on-accent)',
        'border-muted': 'var(--color-border-muted)',
        'border-panel': 'var(--color-border-panel)',
        'border-input-focus': 'var(--color-border-input-focus)',
        'focus-ring': 'var(--color-focus-ring)',
      },
      fontFamily: {
        fancy: ['"Playfair Display"', 'serif'],
      }
    }
  },
  darkMode: 'class', // You already use `.dark`, so this is correct
  plugins: [],
}