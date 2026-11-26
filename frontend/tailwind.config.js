/** @type {import('tailwindcss').Config} */
export default {
  // Scan semua file JS/JSX untuk class yang digunakan
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        blue: {
          300: "#79afde",
          500: "#0f4f86",
          600: "#0f4f86",
          700: "#0d4678",
        },
      },
    },
  },
  plugins: [],
};
