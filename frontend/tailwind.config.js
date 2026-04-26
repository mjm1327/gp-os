export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sidebar': '#0f1629',
        'sidebar-hover': '#1a2139',
        'content': '#ffffff',
        'border': '#e5e7eb',
      },
      fontFamily: {
        'sans': ['system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
