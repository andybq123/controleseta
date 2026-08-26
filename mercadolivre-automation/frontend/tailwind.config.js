/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff8e6",
          100: "#ffedb8",
          400: "#ffd633",
          500: "#ffcc00",
          600: "#e0b200",
          900: "#3a2f00",
        },
      },
    },
  },
  plugins: [],
};
