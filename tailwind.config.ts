import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#185fa5",
        "primary-dark": "#134a80",
        "primary-light": "#e8f0fa",
        positive: "#0F6E56",
        "positive-light": "#e6f4f0",
        negative: "#993C1D",
        "negative-light": "#f9ece7",
        warning: "#854F0B",
        "warning-light": "#fef3e2",
        border: "rgba(0,0,0,0.12)",
      },
      borderRadius: {
        card: "12px",
        element: "8px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        none: "none",
      },
    },
  },
  plugins: [],
};
export default config;
