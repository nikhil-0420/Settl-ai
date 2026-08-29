/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0F1C",
        panel: "#121A2B",
        "panel-raised": "#172239",
        rule: "#24304A",
        "rule-soft": "#1B2740",
        ink: {
          primary: "#EDEFF4",
          muted: "#8891A6",
          faint: "#5A6579",
        },
        brass: {
          DEFAULT: "#D4A94F",
          soft: "#E8C87A",
          dim: "#8A7038",
        },
        settle: {
          match: "#4FBF8B",
          warn: "#E0A73D",
          critical: "#E2685A",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      borderRadius: {
        card: "8px",
      },
      keyframes: {
        settle: {
          "0%": { opacity: "0.3", transform: "translateX(-6px)" },
          "60%": { opacity: "1", transform: "translateX(1px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        tick: {
          "0%": { transform: "scale(0.4)", opacity: "0" },
          "60%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        settle: "settle 0.5s ease-out forwards",
        tick: "tick 0.4s ease-out forwards",
      },
    },
  },
  plugins: [],
};