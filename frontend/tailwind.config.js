/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e7e9ef',
          100: '#c3c8d7',
          200: '#9ba3bc',
          300: '#737ea1',
          400: '#55638d',
          500: '#374879',
          600: '#2f4071',
          700: '#263566',
          800: '#1e2b5c',
          900: '#111b49',
          950: '#0a1030',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
