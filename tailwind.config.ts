import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        unbounded: ['"Unbounded"', "sans-serif"],
        mono: ['"DM Mono"', "monospace"],
      },
      colors: {
        grippy: {
          cobalt: "#0D0D0D",
          "cobalt-dark": "#0D0D0D",
          "cobalt-light": "#222222",
          black: "#0D0D0D",
          cream: "#FFFFFF",
        },
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out forwards",
        "scale-in": "scale-in 0.3s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
