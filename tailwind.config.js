const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.resolve(__dirname, 'index.html'),
    path.resolve(__dirname, 'src/extension/popup/index.html'),
    path.resolve(__dirname, 'src/**/*.{js,ts,jsx,tsx,html}'),
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          black: "#000000",
          surface: "#0c0d0a",
          surfaceHover: "#151710",
          surfaceActive: "#1e2117",
          border: "#3E432E",
          borderLight: "#4e543b",
          olive: "#616F39",
          oliveHover: "#728343",
          lime: "#A7D129",
          limeHover: "#93b824",
          textPrimary: "#f4f6f0",
          textSecondary: "#a2a894",
          textMuted: "#6b725a",
          danger: "#e05252",
          warning: "#d99b26",
          success: "#A7D129",
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace'
        ]
      }
    },
  },
  plugins: [],
}
