/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF', // Deep blue
        secondary: '#D97706', // Amber
        dark: '#1F2937', 
        light: '#F3F4F6'
      }
    },
  },
  plugins: [],
}
