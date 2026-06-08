/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Slack aubergine sidebar (modo oscuro clásico)
        sidebar: "#19171D",
        "sidebar-hover": "rgba(255,255,255,0.08)",
        "sidebar-active": "rgba(255,255,255,0.16)",
        // Área principal
        main: "#1A1D21",
        surface: "#222529",
        // Slack brand
        accent: "#4A154B",      // aubergine (botones primarios)
        "slack-green": "#007A5A", // botón enviar
        "slack-blue": "#1264A3",  // links/menciones
        // Texto
        "t-primary": "#D1D2D3",
        "t-secondary": "#9B9EA4",
        "t-placeholder": "#6B6F76",
      },
      fontFamily: {
        sans: [
          "Lato",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
