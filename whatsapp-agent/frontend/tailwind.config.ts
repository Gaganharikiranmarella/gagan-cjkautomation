import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EAF9F8",
          100: "#CFF1EF",
          200: "#9FE3DF",
          300: "#6DD3CD",
          400: "#3EC1BA",
          500: "#12A9A6", // primary teal — from the CJK Konsultants mark
          600: "#0E8B89",
          700: "#0C6E6D",
          800: "#0A5453",
          900: "#083F3F",
        },
        ink: {
          50: "#F4F4F5",
          100: "#E4E4E6",
          200: "#B8B9BD",
          300: "#8C8E94",
          400: "#5E6067",
          500: "#3A3C42",
          600: "#2B2D33", // charcoal panel
          700: "#212327",
          800: "#1A1B1E", // charcoal background — from the logo card
          900: "#121315",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,32,0.06), 0 1px 8px rgba(16,24,32,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
