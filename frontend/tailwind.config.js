/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        up: '#16c784',
        down: '#ea3943',
      },
      keyframes: {
        flash: {
          '0%': { backgroundColor: 'rgba(99,102,241,0.18)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        flash: 'flash 0.6s ease-out',
      },
    },
  },
  plugins: [],
}
