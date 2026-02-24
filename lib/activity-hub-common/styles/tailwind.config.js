/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan the source file itself so Tailwind knows which utilities are used in @apply directives
  content: ['./activity-hub-src.css'],

  theme: {
    extend: {
      // Material Blue palette as 'brand' — keeps Tailwind's default blue untouched
      colors: {
        brand: {
          50:  '#E3F2FD',
          100: '#BBDEFB',
          200: '#90CAF9',
          300: '#64B5F6',
          400: '#42A5F5',
          500: '#2196F3',  // primary
          600: '#1E88E5',  // hover
          700: '#1976D2',  // active / dark
          800: '#1565C0',
          900: '#0D47A1',
        },
      },

      fontFamily: {
        // System font stack — no download required
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },

      borderRadius: {
        DEFAULT: '0.5rem',   // 8px
        lg:      '0.75rem',  // 12px  — cards
        xl:      '1rem',     // 16px  — large cards
      },

      boxShadow: {
        // Softer, warmer shadows
        sm:    '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.07)',
        DEFAULT:'0 4px 8px -2px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)',
        md:    '0 8px 16px -4px rgba(0,0,0,0.08), 0 4px 8px -4px rgba(0,0,0,0.06)',
        brand: '0 4px 14px 0 rgba(33,150,243,0.25)',
      },
    },
  },

  plugins: [],
};
