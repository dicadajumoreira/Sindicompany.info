import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mint: {
          DEFAULT: "#56CFE1",
          50: "#EAFBFD",
          100: "#D5F7FB",
          500: "#56CFE1",
          600: "#3FB8CB",
          700: "#2E9AAC",
        },
        onix: {
          DEFAULT: "#1E1E24",
          50: "#F4F4F6",
          100: "#E8E8EC",
          800: "#2A2A33",
          900: "#1E1E24",
        },
        g60: "#6B7280",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
