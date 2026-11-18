/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#07080c',
        surface: '#0f1118',
        border: '#1e212d',
        borderLight: '#2a2e3f',
        text: '#f1f5f9',
        textMuted: '#71788e',
        textDim: '#3a3f52',
        income: '#34d399',
        expense: '#f87171'
      }
    },
  },
  plugins: [],
}
