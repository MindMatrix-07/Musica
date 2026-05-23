import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        foreground: "#e8e8ed",
        surface: {
          DEFAULT: "rgb(0 0 0 / 0.25)",
          raised: "rgb(0 0 0 / 0.35)",
          border: "rgb(255 255 255 / 0.12)",
        },
        accent: {
          DEFAULT: "#e879f9",
          muted: "#c026d3",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
