/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        glm: {
          bg: "#0a0f1a",
          surface: "#111827",
          card: "#1a2332",
          border: "#2a3548",
          accent: "#3b9eff",
          accent2: "#00d4aa",
          muted: "#8b9cb3",
          danger: "#ff5c7a",
          warn: "#ffb347",
          success: "#00d4aa",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
