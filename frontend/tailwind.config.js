/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0D2847',
          light: '#1a3a5c',
          dark: '#091e35',
        },
      },
    },
  },
  plugins: [],
};
