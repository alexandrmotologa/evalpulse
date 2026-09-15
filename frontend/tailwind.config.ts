import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        foreground: "#fafafa",
        card: "#121215",
        "card-border": "#27272a",
        muted: "#71717a",
        primary: {
          DEFAULT: "#6366f1",
          hover: "#4f46e5",
        },
      },
    },
  },
  plugins: [],
};

export default config;
