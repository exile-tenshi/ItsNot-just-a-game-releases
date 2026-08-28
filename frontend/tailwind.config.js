/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        glm: {
          bg: "#060a12",
          surface: "#0d1420",
          card: "#121c2e",
          border: "#243047",
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
      boxShadow: {
        "glm-card": "0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
        "glm-glow": "0 0 24px rgba(59, 158, 255, 0.25)",
        "glm-glow-lg": "0 0 40px rgba(59, 158, 255, 0.35)",
        "glm-nav": "0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      animation: {
        "ambient-drift": "ambientDrift 18s ease-in-out infinite",
        "ambient-drift-reverse": "ambientDriftReverse 22s ease-in-out infinite",
        "ambient-pulse": "ambientPulse 14s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "fade-up": "fadeUp 0.5s ease-out both",
      },
      keyframes: {
        ambientDrift: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(40px, 30px) scale(1.08)" },
        },
        ambientDriftReverse: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-35px, -25px) scale(1.06)" },
        },
        ambientPulse: {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.12)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% center" },
          "100%": { backgroundPosition: "-200% center" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
