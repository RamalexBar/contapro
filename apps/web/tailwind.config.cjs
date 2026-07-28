const basePreset = require("@erp/config/tailwind-preset.cjs");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [basePreset],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
