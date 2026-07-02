import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#070A0F",
        panel: "#10151F",
        line: "#222A36",
        mint: "#62D6A3",
        gold: "#E6BC62",
        rose: "#F16C7F"
      },
      boxShadow: {
        glow: "0 0 50px rgba(98, 214, 163, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
