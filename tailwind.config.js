/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{html,js,jsx,ts,tsx,vue}", // Added JSX, TS, TSX, and Vue extensions
  ],
  theme: {
    extend: {
      // Here you can extend your theme
      // Example: colors, spacing, borderRadius, etc.
      colors: {
        'brand-blue': '#0070f3',  // Example: Adding a custom color
      },
      // Example: Extending spacing
      spacing: {
        '128': '32rem',
      }
    },
  },
  plugins: [
    // Here you can add plugins if needed
    // Example: require('@tailwindcss/forms'),
  ],
}