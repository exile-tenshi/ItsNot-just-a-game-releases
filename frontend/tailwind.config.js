/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        glm: {
          bg: "#060912",
          surface: "#0c1220",
          card: "#121a2b",
          "card-hover": "#182236",
          border: "#243049",
          "border-glow": "#3b9eff40",
          accent: "#4da3ff",
          "accent-dim": "#2d7fd4",
          accent2: "#00e5b8",
          muted: "#8fa3bf",
          danger: "#ff6b8a",
          warn: "#ffb84d",
          success: "#00e5b8",
        },
      },
      fontFamily: {
        sans: ["Outfit", "DM Sans", "system-ui", "sans-serif"],
        display: ["Outfit", "DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(77, 163, 255, 0.35)",
        "glow-sm": "0 0 20px -4px rgba(77, 163, 255, 0.25)",
        card: "0 4px 24px -4px rgba(0, 0, 0, 0.5)",
        inner: "inset 0 1px 0 0 rgba(255, 255, 255, 0.04)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        mesh: "radial-gradient(at 0% 0%, rgba(77,163,255,0.12) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(0,229,184,0.08) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(77,163,255,0.06) 0px, transparent 50%)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.35s ease-out",
        shimmer: "shimmer 2.5s ease-in-out infinite",
        "pulse-soft": "pulseSoft 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
