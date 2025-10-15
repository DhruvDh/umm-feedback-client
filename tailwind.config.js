const defaultTheme = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx,css,md,mdx,html,scss}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', ...defaultTheme.fontFamily.mono],
      },
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
